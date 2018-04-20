const DEFAULT_SEARCH_RESNO = true;
const DEFAULT_SEARCH_FILE = true;
const DEFAULT_POPUP_TIME = 100;
const DEFAULT_POPUP_INDENT = 0;
const DEFAULT_POPUP_TODOWN = false;
const DEFAULT_SEARCH_SELECTED_LENGTH = 0;
const DEFAULT_USE_FUTABA_LIGHTBOX = false;
const TEXT_COLOR = "#800000";
const BG_COLOR = "#F0E0D6";
const QUOTE_COLOR = "#789922";
let search_resno = DEFAULT_SEARCH_RESNO;
let search_file = DEFAULT_SEARCH_FILE;
let popup_time = DEFAULT_POPUP_TIME;
let popup_indent = DEFAULT_POPUP_INDENT;
let popup_todown = DEFAULT_POPUP_TODOWN;
let search_selected_length = DEFAULT_SEARCH_SELECTED_LENGTH;
let use_futaba_lightbox = DEFAULT_USE_FUTABA_LIGHTBOX;
let g_thre = null;
let g_line_list = [];
let g_response_list = [];
let g_quote_index_list;
let g_last_response_num = 0;
let selected_elm;
let selected_depth = 0;
let selected_parent_list = [null];
let quote_mouse_down = false;

const SEARCH_RESULT_PERFECT = 0;
const SEARCH_RESULT_MAYBE = 1;
const SEARCH_RESULT_NONE = 2;

class SearchTarget {
    constructor(index, linelist, resno, filename) {
        this.index = index;
        this.lines = linelist.slice();
        this.resno = resno;
        this.filename = filename;
    }

    searchText(text){
        let have_maybe = false;

        for(let i = 0; i < this.lines.length; ++i){
            let find = this.lines[i].indexOf(text);

            if(find != -1){
                if(this.lines[i][0] != ">" || text.length == this.lines[i].length){
                    return SEARCH_RESULT_PERFECT;
                }else{
                    have_maybe = true;
                }
            }else{
                continue;
            }
        }
        
        return have_maybe ? SEARCH_RESULT_MAYBE : SEARCH_RESULT_NONE;
    }

    searchResNo(no){
        // 検索文字列が数字の時はレスNo.の数字部分と比較
        if (no.match(/^\d+$/) && this.resno) {
            return this.resno.slice(3) == no;
        } else {
            return this.resno == no;
        }
    }

    searchFileName(name){
        // 検索文字列が数字の時はファイル名の数字部分と比較
        if (name.match(/^\d+$/) && this.filename.match(/^\d+/)) {
            return this.filename.match(/^\d+/)[0] == name;
        } else {
            return this.filename == name;
        }
    }

    static createByThre(thre) {
        let resno = "";
        let filename = "";

        if(search_resno){
            for (let node = thre.firstChild; node; node = node.nextSibling) {
                if (node.nodeType == Node.ELEMENT_NODE && node.nodeName == "BLOCKQUOTE") {
                    break;
                }
    
                if(node.nodeType == Node.TEXT_NODE){
                    let matches = node.nodeValue.match(/(No\.[0-9]+)/);
                    if (matches) {
                        resno = matches[1];
                        break;
                    }
                }
            }
        }

        if(search_file){
            let anchor = thre.getElementsByTagName("a")[0];
            if(anchor){
                filename = anchor.textContent;
            }
        }

        return new SearchTarget(
            0,
            thre.getElementsByTagName("blockquote")[0].innerText.split(/\r\n|\r|\n/),
            resno,
            filename);
    }

    static createByResponse(index, blockquote) {
        return new SearchTarget(
            index,
            blockquote.innerText.split(/\r\n|\r|\n/),
            search_resno ? SearchTarget.getResNo(blockquote) : "",
            search_file ? SearchTarget.getFileName(blockquote) : "");
    }

    static getResNo(blockquote) {
        for (let node = blockquote.parentNode.firstChild; node; node = node.nextSibling) {
            if (node.nodeType == Node.TEXT_NODE) {
                let matches = node.nodeValue.match(/(No\.[0-9]+)/);
                if (matches) {
                    return matches[1];
                }
            }
        }

        return "";
    }

    static getFileName(blockquote) {
        for (let i = 0, anchors = blockquote.parentElement.getElementsByTagName("a"); i < anchors.length; ++i) {
            let matches = anchors[i].href.match(/([0-9]+\.[0-9A-Za-z]+)/);
            if (matches) {
                return matches[1];
            }
        }

        return "";
    }
}

let search_targets = [];

class Quote {
    constructor(green_text, index, depth = 0, parent = null, select = false) {
        this.green_text = green_text;
        this.index = index;
        this.origin_index = -1;
        this.depth = depth;
        this.parent = parent;
        this.popup = null;
        this.initialized = false;
        this.mouseon = false;
        this.timer = false;
        this.select = select;
        if (this.parent) {
            this.zIndex = this.parent.zIndex;
        } else {
            this.zIndex = 1;
        }

        let quote = this;

        this.green_text.addEventListener("mouseenter", (e) => {
            quote.mouseon = true;

            if (!quote.timer) {
                setTimeout(() => {
                    quote.timer = false;

                    if (quote.mouseon) {
                        quote.show(e);
                    }
                }, popup_time);

                quote.timer = true;
            }

            if (e.buttons == 1) {
                // 文字列選択ドラッグ中に引用にマウスオーバーしたらポップアップ抑制（文字列選択ポップアップ作成優先）
                quote.mouseon = false;
                quote_mouse_down = true;
            } else {
                quote_mouse_down = false;
            }
        });

        this.green_text.addEventListener("mouseleave", (e) => {
            let related_target = e.relatedTarget;
            if (related_target === null || related_target.className == "KOSHIAN_QuoteMenuItem" || related_target.className == "KOSHIAN_QuoteMenuText") {
                document.addEventListener("click", documentClick, false);
                return;
            }
            quote.mouseon = false;
            quote.hide(e);
            quote_mouse_down = false;

            function documentClick(e) {
                let e_target_closest = false;
                for (let elm = e.target; elm; elm = elm.parentElement) {
                    if (elm == quote.green_text) {
                        e_target_closest = true;
                    }
                }
                if (e.target !== null &&
                    e.target.className != "KOSHIAN_QuoteMenuItem" &&
                    e.target.className != "KOSHIAN_QuoteMenuText" &&
                    !e_target_closest) {
                    if (quote.mouseon) {
                        quote.mouseon = false;
                        quote.hide(e);
                        quote_mouse_down = false;
                    }
                    document.removeEventListener("click", documentClick, false);
                }
            }
        });

        this.green_text.addEventListener("mousedown", (e) => {
            if (e.target.nodeName == "FONT" &&
                !quote.select &&
                quote.depth == selected_depth - 1 &&
                !quote_mouse_down) {
                // 引用の上でマウスボタン押下したらポップアップ抑制（引用メニュー対策＆文字列選択ポップアップ作成優先）
                quote.mouseon = false;
                quote.hide(e);
                quote_mouse_down = true;
            }
        });
    }

    findOriginIndex() {
        let search_text = this.green_text.innerText;
        if (this.select) {
            // 文字列選択ポップアップを前面にする
            this.zIndex = this.zIndex + 1;
        } else {
            search_text = search_text.slice(1).replace(/^[\s　]+|[\s　]+$/g, "");
        }
        let origin_kouho = [];

        for (let i = this.index - 1; i >= 0; --i) {
            let target = search_targets[i];
            let result = target.searchText(search_text);

            if(search_resno && target.searchResNo(search_text)){
                return target.index;
            }

            if(search_file && target.searchFileName(search_text)){
                return target.index;
            }

            if(result == SEARCH_RESULT_PERFECT){
                return target.index;
            }else if(result == SEARCH_RESULT_MAYBE){
                origin_kouho.push(target.index);
            }
        }

        if (origin_kouho.length > 0) {
            return origin_kouho[origin_kouho.length - 1];
        } else {
            return -1;
        }
    }

    createPopupThre() {
        this.popup = document.createElement("div");

        // div要素を作りたいのでrd要素のクローンじゃだめ
        for (let ch = g_thre.firstChild; ch != null; ch = ch.nextSibling) {
            this.popup.appendChild(ch.cloneNode(true));
            if (ch.nodeName == "BLOCKQUOTE") {
                break;
            }
        }

        this.popup.className = "KOSHIAN_response";
        this.popup.style.position = "absolute";
        this.popup.style.display = "block";
        this.popup.style.color = TEXT_COLOR;
        this.popup.style.backgroundColor = BG_COLOR;
        this.popup.style.border = "solid 1px";
        this.popup.style.zIndex = this.zIndex;
        this.popup.style.width = "auto";
        this.popup.style.maxWidth = "initial";
        // ポップアップの最小幅を追加（ポップアップサイズの維持）
        this.popup.style.minWidth = "480px";
        this.green_text.appendChild(this.popup);
    }

    createPopupResponse() {
        this.popup = document.createElement("div");

        // div要素を作りたいのでrd要素のクローンじゃだめ
        // g_response_listは最初のスレを含まないので-1
        for (let ch = g_response_list[this.origin_index - 1].firstChild; ch != null; ch = ch.nextSibling) {
            if (ch.nodeType == Node.ELEMENT_NODE && ch.nodeName == "SPAN" && ch.className == "KOSHIAN_reply_no") {
                let anchor = document.createElement("a");
                anchor.href = "javascript:void(0);";
                anchor.title = "このレスに移動";
                anchor.innerText = ch.innerText;
                anchor.addEventListener("click", () => {
                    for (let popup = this; popup; popup = popup.parent) {
                        popup.hide();
                    }
                    moveToResponse(ch);
                }, false);
                this.popup.appendChild(anchor);
            } else {
                this.popup.appendChild(ch.cloneNode(true));
            }
        }

        this.popup.className = "KOSHIAN_response";
        this.popup.style.position = "absolute";
        this.popup.style.display = "block";
        this.popup.style.color = TEXT_COLOR;
        this.popup.style.backgroundColor = BG_COLOR;
        this.popup.style.border = "solid 1px";
        this.popup.style.zIndex = this.zIndex;
        this.popup.style.width = "auto";
        this.popup.style.maxWidth = "initial";
        // ポップアップの最小幅を追加（ポップアップサイズの維持）
        this.popup.style.minWidth = "480px";
        this.green_text.appendChild(this.popup);

        let font_elem_list = this.popup.getElementsByTagName("blockquote")[0].getElementsByTagName("font");
        for (let i = 0; i < font_elem_list.length; ++i) {
            if (font_elem_list[i].color == QUOTE_COLOR) {
                new Quote(font_elem_list[i], this.origin_index, this.depth + 1, this);
            }
        }
    }

    show(e) {
        if (!this.initialized) {
            this.origin_index = this.findOriginIndex();
            this.initialized = true;
            
            switch (this.origin_index) {
                case -1:
                    break;
                case 0:
                    this.createPopupThre();
                    break;
                default:
                    this.createPopupResponse();
            }
        }

        if (this.popup) {
            if (this.depth > 0) {
                let parent_popup_rect = this.parent.popup.getBoundingClientRect();
                let green_text_rect = e.target.getBoundingClientRect();
                let relative_top = green_text_rect.top - parent_popup_rect.top;
                let relative_left = green_text_rect.left - parent_popup_rect.left;
                if (this.select) {
                    // 文字列選択ポップアップはレス本文をポップアップleft位置基準にする
                    let green_text_parent_rect = e.target.parentElement.getBoundingClientRect();
                    relative_left = green_text_parent_rect.left - parent_popup_rect.left;
                }

                if (popup_todown) {
                    this.popup.style.top = `${relative_top + green_text_rect.height - 2}px`;

                } else {
                    this.popup.style.bottom = `${parent_popup_rect.height - relative_top - 2}px`;
                }

                this.popup.style.left = `${relative_left + popup_indent}px`;
                this.popup.style.display = "block";
            } else {
                let rc = Quote.getPopupPosition(e.clientX, e.clientY, this.green_text);

                if (popup_todown) {
                    this.popup.style.top = `${rc.top + rc.height - 2}px`;
                } else {
                    this.popup.style.bottom = `${rc.bottom - 2}px`;
                }

                this.popup.style.left = `${rc.left + popup_indent}px`;
                if (this.select) {
                    // 文字列選択ポップアップはレス本文をポップアップleft位置基準にする
                    let rc_parent = Quote.getPopupPosition(e.clientX, e.clientY, this.green_text.parentElement);
                    this.popup.style.left = `${rc_parent.left + popup_indent}px`;
                }
                this.popup.style.display = "block";
            }
            if (selected_elm) {
                let sel = window.getSelection();
                if (sel.toString().length) {
                    // 文字列選択終点をポップアップ要素の前に移動
                    let sel_range = sel.getRangeAt(0);
                    let selected_koshian_res = selected_elm.firstElementChild;
                    if (selected_koshian_res) {
                        sel_range.setEndBefore(selected_koshian_res);
                    }
                }
            }
            selected_depth = this.depth + 1;
            //console.log("res.js: selected_depth = " + selected_depth);
            selected_parent_list[selected_depth] = this;
        }
    }

    hide(e) {
        if (this.popup) {
            if (use_futaba_lightbox) {
                this.popup.remove();
                this.initialized = false;
            } else {
                this.popup.style.display = "none";
            }
            selected_depth = this.depth;
            //console.log("res.js: selected_depth = " + selected_depth);
        }
    }

    static getPopupPosition(mouse_client_x, mouse_client_y, elem) {
        let rc = {};

        let clientW = document.documentElement.clientWidth;
        let clientH = document.documentElement.clientHeight;
        let page_mouse_x = mouse_client_x + document.documentElement.scrollLeft;
        let page_mouse_y = mouse_client_y + document.documentElement.scrollTop;
        let elem_position = elem.getBoundingClientRect();

        rc.left = (elem_position.left + document.documentElement.scrollLeft);
        rc.top = (elem_position.top + document.documentElement.scrollTop);
        rc.right = clientW - (elem_position.right + document.documentElement.scrollLeft);
        rc.bottom = clientH - (elem_position.top + document.documentElement.scrollTop); // elemの上辺をbottomにする
        rc.width = elem.width;
        rc.height = elem.height;

        return rc;
    }
}

function putIndex(rtd, index){
    if (rtd.firstElementChild.className != "KOSHIAN_reply_no") {
        let reply = document.createElement("span");
        reply.className = "KOSHIAN_reply_no";
        reply.textContent = `${index}`;
        reply.style.color = `#601010`;

        rtd.insertBefore(reply, rtd.firstChild);
    }
}

function createPopup(rtd, index){
    for(let i = 0,font_elements = rtd.getElementsByTagName("font"); i < font_elements.length; ++i){
        if(font_elements[i].color == QUOTE_COLOR){
            new Quote(font_elements[i], index, 0, null);
        }
    }
}

function process(beg, end){
    // add search targets
    for(let i = beg; i < end; ++i){
        search_targets.push(SearchTarget.createByResponse(i + 1, g_response_list[i].getElementsByTagName("blockquote")[0]));
    }

    // put index
    for(let i = beg; i < end; ++i){
        putIndex(g_response_list[i], i + 1);
    }

    // create popup
    for(let i = beg; i < end; ++i){
        createPopup(g_response_list[i], i + 1);
    }
}

function main() {
    g_thre = document.getElementsByClassName("thre")[0];
    if (g_thre == null) {
        return;
    }
    
    g_response_list = g_thre.getElementsByClassName("rtd");

    // add search targets by thre
    search_targets.push(SearchTarget.createByThre(g_thre));

    process(0, g_response_list.length);
    g_last_response_num = g_response_list.length;

    document.addEventListener("KOSHIAN_reload", (e) => {
        let prev_res_num = g_last_response_num;
        let cur_res_num = g_response_list.length;
        process(prev_res_num, cur_res_num);
        g_last_response_num = cur_res_num;
    });
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);

}

function onMouseDown(e) {
    if (e.button != 0 || !search_selected_length) return;
    // 左ボタン押下場所が選択文字列のfont要素ならテキスト置換中止
    if (e.target.className == "KOSHIAN_selected_font") return;

    // 選択文字列のfont要素をテキストノードに戻す
    let koshian_response = e.target.closest(".KOSHIAN_response");
    replaceText(koshian_response, "KOSHIAN_selected_font");
    selected_elm = null;
}

function onMouseUp(e) {
    if (e.button != 0 || (!selected_elm && !search_selected_length)) return;
    // 左ボタンを離した場所が選択文字列のfont要素上なら中止
    if (e.target.className == "KOSHIAN_selected_font") return;

    // 選択文字列のfont要素をテキストノードに戻す
    let koshian_response = e.target.closest(".KOSHIAN_response");
    replaceText(koshian_response, "KOSHIAN_selected_font");
    selected_elm = null;

    if (!search_selected_length) return;

    let sel = window.getSelection();
    let sel_str = sel.toString();
    if (sel_str.length < search_selected_length ||
        sel_str.match(/[\r\n]/) ||
        sel.rangeCount > 1) return;
    let sel_elm = sel.anchorNode;
    if (sel_elm.nodeName != "BLOCKQUOTE") {
        sel_elm = sel_elm.parentNode;
        // 選択場所がレス本文以外なら中止
        if (!checkBlockquote(sel_elm)) return;
    }

    let font_elm = document.createElement("font");
    font_elm.classList.add("KOSHIAN_selected_font");
    font_elm.style.color = "red";
    let sel_range = sel.getRangeAt(0);
    if (sel.anchorNode.nodeName == "BLOCKQUOTE") {
        let sel_start = sel.anchorNode.childNodes[sel.anchorOffset];
        if (sel_start.nodeName == "FONT" && sel_start.className != "KOSHIAN_selected_font") {
            // 選択始点に引用のfont要素があるので始点をテキストノードの前に移動
            let first_text_node = sel.anchorNode.childNodes[sel.anchorOffset].firstChild;
            sel_range.setStartBefore(first_text_node);
            sel = window.getSelection();
            sel_elm = sel.anchorNode.parentNode;
        }
    }
    
    try {
        sel_range.surroundContents(font_elm);
    } catch(e) {
        if (sel.focusNode.nodeName == "BLOCKQUOTE") {
            let node = null;
            if (sel.anchorNode.nodeName == "FONT") {
                node = sel.anchorNode.lastChild;
            } else if (sel.anchorNode.nodeName == "#text") {
                node = sel_elm.lastChild;
            }
            // 選択終点がblockquoteで始点がblockquote以外の場合
            // 終点にテキスト以外のノードがあるので終点をテキストノードの後に移動
            for (node; node; node = node.previousSibling) {
                if (node.nodeType == Node.TEXT_NODE) {
                    sel_range.setEndAfter(node);
                    break;
                }
            }
        }
        try {
            sel_range.surroundContents(font_elm);
        } catch(e) {
            console.log ("res.js: surround contents error: " + e);
        }
    } finally {
        selected_elm = sel_elm.getElementsByClassName("KOSHIAN_selected_font")[0];
        let selected_index = 0;
        if (selected_elm) {
            for (let elm = sel_elm; elm; elm = elm.parentElement) {
                if (elm.className == "rtd" || elm.className == "KOSHIAN_response") {
                    let selected_reply_no = elm.firstElementChild;
                    if (selected_reply_no.className == "KOSHIAN_reply_no") {
                        selected_index = Number(selected_reply_no.innerText);
                    }
                    break;
                }
            }
            if (selected_index) {
                new Quote(selected_elm, selected_index, selected_depth, selected_parent_list[selected_depth], true);
            }
        }
    }
}

function replaceText(element, class_name){
    // element要素下のクラス名class_nameの要素をテキストノードに置換
    // elementがnullの時は全てのclass_nameをテキストノードに置換
    element = element ? element : document;
    let elements = element.getElementsByClassName(class_name);
    if (elements) {
        for (let i = 0; i < elements.length; i++) {
            let text = getText(elements[i]);
            if (text) {
                let text_node = document.createTextNode(text);
                let elm_parent = elements[i].parentNode;
                elm_parent.replaceChild(text_node, elements[i]);
            }
        }
    }

    function getText(element){
        // 子要素のテキストを含まないelementのテキストを取得
        if (element.childNodes) {
            return element.childNodes[0].wholeText;
        }
        return "";
    }
}

function checkBlockquote(element){
    // elementがblockquote内ならtrueを返す
    for (element; element; element = element.parentNode) {
        if (element.nodeName == "BLOCKQUOTE") return true;
        if (element.className == "rtd" || element.className == "KOSHIAN_response") return false;
    }
    return false;
}

function moveToResponse(replyNo){
    let input = replyNo.nextElementSibling;
    if (input.nodeName == "INPUT" && input.id) {
        let target = document.getElementById(input.id);
        if (target) {
            target.scrollIntoView(true);
        }
    }
}

function safeGetValue(value, default_value) {
    return value === undefined ? default_value : value;
}

function onError(error) {

}

function onLoadSetting(result) {
    search_resno = safeGetValue(result.search_resno, DEFAULT_SEARCH_RESNO);
    search_file = safeGetValue(result.search_file, DEFAULT_SEARCH_FILE);
    popup_time = Number(safeGetValue(result.popup_time, DEFAULT_POPUP_TIME));
    popup_indent = Number(safeGetValue(result.popup_indent, DEFAULT_POPUP_INDENT));
    popup_todown = safeGetValue(result.popup_todown, DEFAULT_POPUP_TODOWN);
    search_selected_length = Number(safeGetValue(result.search_selected_length, DEFAULT_SEARCH_SELECTED_LENGTH));
    use_futaba_lightbox = safeGetValue(result.use_futaba_lightbox, DEFAULT_USE_FUTABA_LIGHTBOX);

    main();
}

function onSettingChanged(changes, areaName) {
    if (areaName != "local") {
        return;
    }

    search_resno = safeGetValue(changes.search_resno.newValue, DEFAULT_SEARCH_RESNO);
    search_file = safeGetValue(changes.search_file.newValue, DEFAULT_SEARCH_FILE);
    popup_time = Number(safeGetValue(changes.popup_time.newValue, DEFAULT_POPUP_TIME));
    popup_indent = Number(safeGetValue(changes.popup_indent.newValue, DEFAULT_POPUP_INDENT));
    popup_todown = safeGetValue(changes.popup_todown.newValue, DEFAULT_POPUP_TODOWN);
    search_selected_length = Number(safeGetValue(changes.search_selected_length.newValue, DEFAULT_SEARCH_SELECTED_LENGTH));
    use_futaba_lightbox = safeGetValue(changes.use_futaba_lightbox.newValue, DEFAULT_USE_FUTABA_LIGHTBOX);
}

browser.storage.local.get().then(onLoadSetting, onError);
browser.storage.onChanged.addListener(onSettingChanged);