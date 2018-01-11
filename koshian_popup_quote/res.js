const DEFAULT_SEARCH_RESNO = true;
const DEFAULT_SEARCH_FILE = true;
const DEFAULT_POPUP_TIME = 100;
const DEFAULT_POPUP_INDENT = 0;
const DEFAULT_POPUP_TODOWN = false;
const DEFAULT_SEARCH_SELECTED_LENGTH = 0;
const TEXT_COLOR = "#800000";
const BG_COLOR = "#F0E0D6";
const QUOTE_COLOR = "#789922";
let search_resno = DEFAULT_SEARCH_RESNO;
let search_file = DEFAULT_SEARCH_FILE;
let popup_time = DEFAULT_POPUP_TIME;
let popup_indent = DEFAULT_POPUP_INDENT;
let popup_todown = DEFAULT_POPUP_TODOWN;
let search_selected_length = DEFAULT_SEARCH_SELECTED_LENGTH;
let g_thre = null;
let g_line_list = [];
let g_response_list = [];
let g_quote_index_list;
let g_last_response_num = 0;
let selected_elm,slected_text_node;

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
        return this.resno == no;
    }

    searchFileName(name){
        return this.filename == name;
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
    constructor(green_text, index, depth = 0, parent = null) {
        this.green_text = green_text;
        this.index = index;
        this.origin_index = -1;
        this.depth = depth;
        this.parent = parent;
        this.popup = null;
        this.initialized = false;
        this.mouseon = false;
        this.timer = false;
        this.zIndex = 1;

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
        });

        this.green_text.addEventListener("mouseleave", (e) => {
            quote.mouseon = false;
            quote.hide(e);
        });
    }

    findOriginIndex() {
        let search_text = this.green_text.innerText;
        if (search_text.charAt(0) == ">") {
            search_text = search_text.slice(1);
        } else {
            this.zIndex = 2;
        }
        let origin_kouho = [];

        for (let i = this.index - 1; i >= 0; --i) {
            let target = search_targets[i];
            let result = target.searchText(search_text);
            
            if(result == SEARCH_RESULT_PERFECT){
                return target.index;
            }else if(result == SEARCH_RESULT_MAYBE){
                origin_kouho.push(target.index);
            }

            if(search_resno && target.searchResNo(search_text)){
                return target.index;
            }

            if(search_file && target.searchFileName(search_text)){
                return target.index;
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
        if (this.depth > 0) {
            if (this.zIndex < this.parent.zIndex) {
                this.zIndex = this.parent.zIndex;
            }
        }
        this.popup.style.zIndex = this.zIndex;
        this.popup.style.width = "auto";
        this.popup.style.maxWidth = "initial";
        this.green_text.appendChild(this.popup);
    }

    createPopupResponse() {
        this.popup = document.createElement("div");

        // div要素を作りたいのでrd要素のクローンじゃだめ
        // g_response_listは最初のスレを含まないので-1
        for (let ch = g_response_list[this.origin_index - 1].firstChild; ch != null; ch = ch.nextSibling) {
            this.popup.appendChild(ch.cloneNode(true));
        }

        this.popup.className = "KOSHIAN_response";
        this.popup.style.position = "absolute";
        this.popup.style.display = "block";
        this.popup.style.color = TEXT_COLOR;
        this.popup.style.backgroundColor = BG_COLOR;
        this.popup.style.border = "solid 1px";
        if (this.depth > 0) {
            if (this.zIndex < this.parent.zIndex) {
                this.zIndex = this.parent.zIndex;
            }
        }
        this.popup.style.zIndex = this.zIndex;
        this.popup.style.width = "auto";
        this.popup.style.maxWidth = "initial";
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
                this.popup.style.display = "block";
            }
            if (selected_elm && this.depth == 0) {
                let sel_range = window.getSelection().getRangeAt(0);
                let selected_koshian_res = document.getElementById("selected").firstElementChild;
                if (selected_koshian_res) {
                    sel_range.setEndBefore(selected_koshian_res);
                }
            }
        }
    }

    hide(e) {
        if (this.popup) {
            this.popup.style.display = "none";
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
    let reply = document.createElement("span");
    reply.className = "KOSHIAN_reply_no";
    reply.textContent = `${index}`;
    reply.style.color = `#601010`;

    rtd.insertBefore(reply, rtd.firstChild);
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
    document.addEventListener("mouseup", onMouseUp);

}

function onMouseUp(e) {
    if (e.button != 0 || e.target.closest(".KOSHIAN_response")) return;
    if (selected_elm) {
        selected_elm.parentNode.replaceChild(selected_text_node, selected_elm);
        selected_elm = null;
        selected_text_node = null;
    }
    if (!search_selected_length) return;
    let sel = window.getSelection();
    let sel_str = sel.toString();
    if (!sel_str) return;
    if (sel_str.length < search_selected_length || sel_str.match(/[\r\n]/)) return;
    let sel_parent_elm = sel.anchorNode.parentElement;
    if (!sel_parent_elm.closest("blockquote")) return;

    let font_elm = document.createElement("font");
    font_elm.id = "selected";
    try {
        let sel_range = sel.getRangeAt(0);
        sel_range.surroundContents(font_elm);
        selected_elm = document.getElementById("selected");
        selected_text_node = document.createTextNode(selected_elm.innerText);
        let selected_index = 0;
        for (let node = selected_elm.parentNode; node; node = node.parentNode) {
            if (node.className == "rtd") {
                let selected_reply_no = node.firstChild;
                if (selected_reply_no.className == "KOSHIAN_reply_no") {
                    selected_index = Number(selected_reply_no.innerText);
                }
                break;
            }
        }
        if (selected_index) {
            new Quote(selected_elm, selected_index, 0, null);
        }
    } catch(e) {
//      console.log("res.js: surround contents error");
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
}

browser.storage.local.get().then(onLoadSetting, onError);
browser.storage.onChanged.addListener(onSettingChanged);