const DEFAULT_SEARCH_RESNO = true;
const DEFAULT_SEARCH_FILE = true;
const DEFAULT_POPUP_TIME = 100;
const DEFAULT_POPUP_INDENT = 0;
const DEFAULT_POPUP_TODOWN = true;
const DEFAULT_POPUP_NEAR = false;
const DEFAULT_POPUP_PERFECT = true;
const DEFAULT_SEARCH_SELECTED_LENGTH = 0;
const DEFAULT_SEARCH_REPLY = true;
const DEFAULT_POPUP_FONT_SIZE = 0;
const DEFAULT_POPUP_IMG_SCALE = 100;
const DEFAULT_USE_FUTABA_LIGHTBOX = true;
const DEFAULT_POPUP_HIDDEN_TIME = 300;
const TEXT_COLOR = "#800000";
const BG_COLOR = "#F0E0D6";
const QUOTE_COLOR = "#789922";
const REPLY_COLOR = "#789922";
let search_resno = DEFAULT_SEARCH_RESNO;
let search_file = DEFAULT_SEARCH_FILE;
let popup_time = DEFAULT_POPUP_TIME;
let popup_indent = DEFAULT_POPUP_INDENT;
let popup_todown = DEFAULT_POPUP_TODOWN;
let popup_near = DEFAULT_POPUP_NEAR;
let popup_perfect = DEFAULT_POPUP_PERFECT;
let search_selected_length = DEFAULT_SEARCH_SELECTED_LENGTH;
let search_reply = DEFAULT_SEARCH_REPLY;
let popup_font_size = DEFAULT_POPUP_FONT_SIZE;
let popup_img_scale = DEFAULT_POPUP_IMG_SCALE;
let use_futaba_lightbox = DEFAULT_USE_FUTABA_LIGHTBOX;
let popup_hidden_time = DEFAULT_POPUP_HIDDEN_TIME;
let g_thre = null;
let g_response_list = [];
let g_last_response_num = 0;
let selected_elm;
let selected_depth = 0;
let selected_parent_list = [null];
let quote_mouse_down = false;
let have_sod = false;
let have_del = false;

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
                if(text.length == this.lines[i].length){
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
            let number_button = document.querySelector(".thre > .KOSHIAN_NumberButton");
            if (number_button) {
                resno = number_button.textContent;
            } else {
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
        }

        if(search_file){
            let anchor = thre.getElementsByTagName("a")[0];
            if(anchor){
                if(anchor.download){
                    filename = anchor.download;
                } else {
                    filename = anchor.textContent;
                }
            }
        }

        // プレビューボタンを除いたスレ本文のテキストを取得
        let blockquote_text = getInnerText(thre.getElementsByTagName("blockquote")[0], "KOSHIAN_PreviewSwitch");
        return new SearchTarget(
            0,
            blockquote_text.split(/\r\n|\r|\n/),
            resno,
            filename);
    }

    static createByResponse(index, blockquote) {
        // プレビューボタンを除いたレス本文のテキストを取得
        let blockquote_text = getInnerText(blockquote, "KOSHIAN_PreviewSwitch");
        return new SearchTarget(
            index,
            blockquote_text.split(/\r\n|\r|\n/),
            search_resno ? SearchTarget.getResNo(blockquote) : "",
            search_file ? SearchTarget.getFileName(blockquote) : "");
    }

    static getResNo(blockquote) {
        let number_button = blockquote.parentNode.getElementsByClassName("KOSHIAN_NumberButton")[0];
        if (number_button) {
            return number_button.textContent;
        }

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

/**
 * 引用ポップアップ制御クラス
 * @param {HTMLFontElement} green_text 引用のFont要素
 * @param {number} index 引用のあるレスのレス番号（スレ内の通番）
 * @param {number} depth ポップアップの深さ
 * @param {Quote} parent 親ポップアップの引用クラス
 * @param {boolean} is_selected 文字列選択による引用か
 * @constructor
 */
class Quote {
    constructor(green_text, index, depth = 0, parent = null, is_selected = false) {
        this.green_text = green_text;
        this.index = index;
        this.origin_index = -1;
        this.depth = depth;
        this.parent = parent;
        this.popup = null;
        this.initialized = false;
        this.mouseon = false;
        this.timer_shown = null;
        this.timer_hidden = null;
        this.is_selected = is_selected;
        if (this.parent) {
            this.zIndex = this.parent.zIndex;
        } else {
            this.zIndex = 1;
        }

        let quote = this;

        this.green_text.addEventListener("mouseenter", (e) => {
            quote.mouseon = true;
            if (quote.timer_hidden) {
                clearTimeout(quote.timer_hidden);
                quote.timer_hidden = null;
            }

            if (!quote.timer_shown) {
                quote.timer_shown = setTimeout(() => {
                    quote.timer_shown = null;

                    if (quote.mouseon) {
                        quote.show(e);
                    }
                }, popup_time);
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
            if (related_target === null ||
                related_target.className == "KOSHIAN_QuoteMenuItem" ||
                related_target.className == "KOSHIAN_QuoteMenuText") {
                // 移動先がコンテキストメニューか引用メニューならポップアップを閉じないでクリックを監視する
                document.addEventListener("click", hideQuotePopup, false);
                return;
            }

            quote.mouseon = false;
            if (quote.timer_shown) {
                clearTimeout(quote.timer_shown);
                quote.timer_shown = null;
            }

            if (!quote.timer_hidden) {
                quote.timer_hidden = setTimeout(() => {
                    quote.timer_hidden = null;
                    quote.hide(e);
                    quote_mouse_down = false;
                }, popup_hidden_time);
            }

            function hideQuotePopup(e) {
                let e_target_closest = false;
                for (let elm = e.target; elm; elm = elm.parentElement) {
                    if (elm == quote.green_text) {
                        e_target_closest = true;
                    }
                }
                if (e.target !== null
                    && e.target.className != "KOSHIAN_QuoteMenuItem"
                    && e.target.className != "KOSHIAN_QuoteMenuText"
                    && !e_target_closest) {
                    // クリックしたのがコンテキストメニューでも引用メニューでもポップアップ自身でもなければポップアップを閉じる
                    if (quote.mouseon) {
                        quote.mouseon = false;
                        quote.hide(e);
                        quote_mouse_down = false;
                    }
                    document.removeEventListener("click", hideQuotePopup, false);
                }
            }
        });

        this.green_text.addEventListener("mousedown", (e) => {
            if (this.green_text == e.target &&
                this.popup &&
                !quote_mouse_down) {
                // 引用の上でマウスボタン押下したらポップアップ抑制（引用メニュー対策＆文字列選択ポップアップ作成優先）
                quote.mouseon = false;
                quote.hide(e);
                quote_mouse_down = true;
            }
        });
    }

    findOriginIndex(is_reply, target_index = -1) {
        // プレビューボタンを除いた引用文のテキストを取得
        let search_text = getInnerText(this.green_text, "KOSHIAN_PreviewSwitch");
        if (this.is_selected) {
            // 文字列選択ポップアップを前面にする
            this.zIndex = this.zIndex + 1;
        } else {
            search_text = search_text.slice(1).replace(/^[\s]+|[\s]+$/g, "");
        }
        if (!search_text.length) {
            return -1;
        }

        let origin = [];    // 行単位で一致
        let origin_kouho = [];  // 部分一致

        if (is_reply && target_index > -1) {
            let target = search_targets[target_index];

            if(search_resno && target.searchResNo(search_text)){
                return target.index;
            }

            if(search_file && target.searchFileName(search_text)){
                return target.index;
            }

            let result = target.searchText(search_text);
            if(result == SEARCH_RESULT_PERFECT){
                return target.index;
            }

        } else {
            for (let i = this.index - 1; i >= 0; --i) {
                let target = search_targets[i];

                if(search_resno && target.searchResNo(search_text)){
                    return target.index;
                }

                if(search_file && target.searchFileName(search_text)){
                    return target.index;
                }

                let result = target.searchText(search_text);
                if(result == SEARCH_RESULT_PERFECT){
                    if((popup_perfect && popup_near) || is_reply){
                        return target.index;
                    }else if(popup_perfect){
                        origin.push(target.index);
                    }else{
                        origin_kouho.push(target.index);
                    }
                }else if(result == SEARCH_RESULT_MAYBE){
                    origin_kouho.push(target.index);
                }
            }
        }

        if (origin.length > 0) {
            return origin[origin.length - 1];
        }
        if (origin_kouho.length > 0 && !is_reply) {
            if (popup_near) {
                return origin_kouho[0];
            } else {
                return origin_kouho[origin_kouho.length - 1];
            }
        } else {
            return -1;
        }
    }

    createPopupThre() {
        this.popup = document.createElement("div");

        // div要素を作りたいのでrd要素のクローンじゃだめ
        for (let ch = g_thre.firstChild; ch != null; ch = ch.nextSibling) {
            if (ch.nodeType == Node.ELEMENT_NODE && ch.nodeName == "SPAN" && ch.className == "KOSHIAN_reply_no") {
                let anchor = document.createElement("a");
                anchor.href = "javascript:void(0);";
                anchor.className = "KOSHIAN_reply_no";
                anchor.title = "スレ先頭に移動";
                anchor.innerText = `[スレ] `;
                anchor.addEventListener("click", () => {
                    for (let popup = this; popup; popup = popup.parent) {
                        popup.hide();
                    }
                    moveToResponse(ch);
                }, false);
                this.popup.appendChild(anchor);
            } else if (ch.nodeType == Node.ELEMENT_NODE && ch.className == "KOSHIAN_ReplyNo") {
                let clone = ch.cloneNode(true);
                clone.className = "KOSHIAN_PopupReply";
                this.popup.appendChild(clone);
            } else {
                this.popup.appendChild(ch.cloneNode(true));
                if (ch.nodeName == "BLOCKQUOTE") {
                    break;
                }
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
        if (popup_font_size) {
            this.popup.style.fontSize = `${popup_font_size}px`;
            // ポップアップ内のKOSHIAN画像保存ボタンにフォントサイズを再設定
            let image_save_button = this.popup.getElementsByClassName("KOSHIAN_SaveButton")[0];
            if (image_save_button && image_save_button.style.fontSize) {
                let button_font_size = parseInt(image_save_button.style.fontSize, 10);
                if (button_font_size > popup_font_size) {
                    image_save_button.style.fontSize = `${popup_font_size}px`;
                }
            }
        } else {
            this.popup.style.fontSize = "";
        }

        // ポップアップの表示幅を測定
        document.body.appendChild(this.popup);  // bodyの直下に配置して幅を測定
        this.popup.style.left = "0px";
        // 測定前にサムネ画像倍率を反映
        let popup_imgs = this.popup.getElementsByTagName("img");
        for (let popup_img of popup_imgs) {
            let popup_img_rect = popup_img.getBoundingClientRect();
            if (popup_img_rect.width && popup_img_rect.height) {
                popup_img.width = popup_img_rect.width * popup_img_scale / 100;
                popup_img.height = popup_img_rect.height * popup_img_scale / 100;
            } else if (popup_img.style.maxWidth && popup_img.style.maxHeight) {
                popup_img.style.maxWidth = `${parseInt(popup_img.style.maxWidth, 10) * popup_img_scale / 100}px`;
                popup_img.style.maxHeight = `${parseInt(popup_img.style.maxHeight, 10) * popup_img_scale / 100}px`;
            } else {
                continue;
            }
            let blockquote = popup_img.parentNode.nextElementSibling;
            if (blockquote && blockquote.tagName == "BLOCKQUOTE") {
                let margin_left = blockquote.style.marginLeft;
                if (margin_left && popup_img.width) {
                    // コメントの左マージンをサムネ画像倍率に合わせる
                    blockquote.style.marginLeft = `${popup_img.width + 40}px`;
                }
            }
        }
        let popup_rect = this.popup.getBoundingClientRect();
        this.popup.style.minWidth = `${popup_rect.width}px`;    // 本来の表示幅より狭くならないように最小幅を設定
        this.popup.remove();
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
                anchor.className = "KOSHIAN_reply_no";
                anchor.title = "このレスに移動";
                anchor.innerText = `[${ch.innerText}]`;
                anchor.addEventListener("click", () => {
                    for (let popup = this; popup; popup = popup.parent) {
                        popup.hide();
                    }
                    moveToResponse(ch);
                }, false);
                this.popup.appendChild(anchor);
            } else if (ch.nodeType == Node.ELEMENT_NODE && ch.className == "KOSHIAN_ReplyNo") {
                let clone = ch.cloneNode(true);
                clone.className = "KOSHIAN_PopupReply";
                this.popup.appendChild(clone);
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
        if (popup_font_size) {
            this.popup.style.fontSize = `${popup_font_size}px`;
            // ポップアップ内のKOSHIAN画像保存ボタンにフォントサイズを再設定
            let image_save_button = this.popup.getElementsByClassName("KOSHIAN_SaveButton")[0];
            if (image_save_button && image_save_button.style.fontSize) {
                let button_font_size = parseInt(image_save_button.style.fontSize, 10);
                if (button_font_size > popup_font_size) {
                    image_save_button.style.fontSize = `${popup_font_size}px`;
                }
            }
        } else {
            this.popup.style.fontSize = "";
        }

        // ポップアップの表示幅を測定
        document.body.appendChild(this.popup);  // bodyの直下に配置して幅を測定
        this.popup.style.left = "0px";
        // 測定前にサムネ画像倍率を反映
        let popup_imgs = this.popup.getElementsByTagName("img");
        for (let popup_img of popup_imgs) {
            let popup_img_rect = popup_img.getBoundingClientRect();
            if (popup_img_rect.width && popup_img_rect.height) {
                popup_img.width = popup_img_rect.width * popup_img_scale / 100;
                popup_img.height = popup_img_rect.height * popup_img_scale / 100;
            } else if (popup_img.style.maxWidth && popup_img.style.maxHeight) {
                popup_img.style.maxWidth = `${parseInt(popup_img.style.maxWidth, 10) * popup_img_scale / 100}px`;
                popup_img.style.maxHeight = `${parseInt(popup_img.style.maxHeight, 10) * popup_img_scale / 100}px`;
            } else {
                continue;
            }
            let blockquote = popup_img.parentNode.nextElementSibling;
            if (blockquote && blockquote.tagName == "BLOCKQUOTE") {
                let margin_left = blockquote.style.marginLeft;
                if (margin_left && popup_img.width) {
                    // コメントの左マージンをサムネ画像倍率に合わせる
                    blockquote.style.marginLeft = `${popup_img.width + 40}px`;
                }
            }
        }
        let popup_rect = this.popup.getBoundingClientRect();
        this.popup.style.minWidth = `${popup_rect.width}px`;    // 本来の表示幅より狭くならないように最小幅を設定
        this.popup.remove();
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
                if (this.is_selected) {
                    // 文字列選択ポップアップはレス本文をポップアップleft位置基準にする
                    let green_text_parent_rect = e.target.parentElement.getBoundingClientRect();
                    relative_left = green_text_parent_rect.left - parent_popup_rect.left;
                }

                if (popup_todown) {
                    this.popup.style.top = `${relative_top + green_text_rect.height - 2}px`;

                } else {
                    this.popup.style.bottom = `${parent_popup_rect.height - relative_top - 2}px`;
                }

                let popup_left = relative_left + popup_indent;
                this.popup.style.left = "0px";
                this.popup.style.display = "block";

                // ポップアップが画面右端からはみ出る時は右端にそろえる
                let popup_rect = this.popup.getBoundingClientRect();
                let doc_width = document.documentElement.clientWidth;
                let window_right = doc_width + document.documentElement.scrollLeft;
                if (parent_popup_rect.left + popup_left + popup_rect.width > window_right) {
                    if (doc_width < popup_rect.width) {
                        this.popup.style.maxWidth = `${doc_width}px`;
                        this.popup.style.minWidth = `${doc_width}px`;
                    }
                    this.popup.style.left = "";
                    this.popup.style.right = `${parent_popup_rect.right - window_right}px`;
                } else {
                    this.popup.style.left = `${popup_left}px`;
                }
            } else {
                let rc = Quote.getPopupPosition(e.clientX, e.clientY, this.green_text);

                if (popup_todown) {
                    this.popup.style.top = `${rc.top + rc.height - 2}px`;
                } else {
                    this.popup.style.bottom = `${rc.bottom - 2}px`;
                }

                let popup_left = rc.left + popup_indent;
                if (this.is_selected) {
                    // 文字列選択ポップアップはレス本文をポップアップleft位置基準にする
                    let rc_parent = Quote.getPopupPosition(e.clientX, e.clientY, this.green_text.parentElement);
                    popup_left = rc_parent.left + popup_indent;
                }
                this.popup.style.left = "0px";
                this.popup.style.display = "block";

                // ポップアップが画面右端からはみ出る時は右端にそろえる
                let popup_rect = this.popup.getBoundingClientRect();
                let doc_width = document.documentElement.clientWidth;
                let window_right = doc_width + document.documentElement.scrollLeft;
                if (popup_left + popup_rect.width > window_right) {
                    if (doc_width < popup_rect.width) {
                        this.popup.style.maxWidth = `${doc_width}px`;
                        this.popup.style.minWidth = `${doc_width}px`;
                    }
                    this.popup.style.left = "";
                    this.popup.style.right = "0px";
                } else {
                    this.popup.style.left = `${popup_left}px`;
                }
            }

            if (selected_elm) {
                let sel = window.getSelection();
                if (sel.toString().length) {
                    // 文字列選択終点をポップアップ要素の前に移動
                    let sel_range = sel.getRangeAt(0);
                    let selected_koshian_res = selected_elm.getElementsByClassName("KOSHIAN_response")[0];
                    if (selected_koshian_res) {
                        sel_range.setEndBefore(selected_koshian_res);
                    }
                }
            }
            selected_depth = this.depth + 1;
            //console.log("res.js: selected_depth = " + selected_depth);
            selected_parent_list[selected_depth] = this;

            let number_button = this.popup.getElementsByClassName("KOSHIAN_NumberButton")[0];
            if (number_button) {
                // KOSHIAN 引用メニュー 改のNo.ボタンのclassを書換
                number_button.className = "KOSHIAN_PopupNumber";
            }

            let hide_button = this.popup.getElementsByClassName("KOSHIAN_HideButton")[0];
            if (hide_button) {
                //hide_button.className = "KOSHIAN_PopupHide";
                // KOSHIAN NG 改の[隠す]ボタンを削除
                hide_button.remove();
            }

            let ng_switch = this.popup.getElementsByClassName("KOSHIAN_NGSwitch")[0];
            if (ng_switch) {
                //ng_switch.className = "KOSHIAN_PopupNG";
                // KOSHIAN NG 改の[NGワード]ボタンを削除
                ng_switch.remove();
            }

            let save_button = this.popup.getElementsByClassName("KOSHIAN_SaveButton")[0];
            if (save_button) {
                // KOSHIAN 画像保存ボタンの[保存]ボタンのclassを書換
                save_button.className = "KOSHIAN_PopupSave";
            }

            let preview_switches = this.popup.getElementsByClassName("KOSHIAN_PreviewSwitch");
            while (preview_switches.length) {
                // KOSHIAN 自動リンク生成の[隠す]ボタンを削除
                preview_switches[0].remove();
            }

            document.dispatchEvent(new CustomEvent("KOSHIAN_popupQuote"));
        }
    }

    hide(e) {   // eslint-disable-line no-unused-vars
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
        //let page_mouse_x = mouse_client_x + document.documentElement.scrollLeft;
        //let page_mouse_y = mouse_client_y + document.documentElement.scrollTop;
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

/**
 * 返信レス番号ポップアップ制御クラス
 * @param {HTMLSpanElement} green_text 返信番号のSpan要素
 * @param {number} index 返信レスのレス番号（スレ内の通番）
 * @constructor
 */
class Reply {
    constructor (green_text, index) {
        this.green_text = green_text;
        this.index = index;
        this.popup = null;
        this.mouseon = false;
        this.timer = null;

        let reply = this;

        this.green_text.addEventListener("mouseenter", (e) => {
            if (reply.mouseon) {
                return;
            }
            reply.mouseon = true;

            if (!reply.timer) {
                reply.timer = setTimeout(() => {
                    reply.timer = null;

                    if (reply.mouseon) {
                        reply.show(e);
                    }
                }, popup_time);
            }
        });

        this.green_text.addEventListener("mouseleave", (e) => {
            let related_target = e.relatedTarget;
            if (related_target === null || related_target.className == "KOSHIAN_QuoteMenuItem" || related_target.className == "KOSHIAN_QuoteMenuText") {
                // 移動先がコンテキストメニューか引用メニューならポップアップを閉じないでクリックを監視する
                document.addEventListener("click", hideReplyPopup, false);
                return;
            }

            reply.mouseon = false;
            if (reply.timer) {
                clearTimeout(reply.timer);
                reply.timer = null;
            }

            reply.hide();

            function hideReplyPopup(e) {
                let e_target_closest = false;
                for (let elm = e.target; elm; elm = elm.parentElement) {
                    if (elm == reply.green_text) {
                        e_target_closest = true;
                    }
                }
                if (e.target !== null &&
                    e.target.className != "KOSHIAN_QuoteMenuItem" &&
                    e.target.className != "KOSHIAN_QuoteMenuText" &&
                    !e_target_closest) {
                    // クリックしたのがコンテキストメニューでも引用メニューでもポップアップ自身でもなければポップアップを閉じる
                    if (reply.mouseon) {
                        reply.mouseon = false;
                        reply.hide();
                    }
                    document.removeEventListener("click", hideReplyPopup, false);
                }
            }
        });
    }

    createPopup() {
        this.popup = document.createElement("div");

        // div要素を作りたいのでrd要素のクローンじゃだめ
        // g_response_listは最初のスレを含まないので-1
        for (let ch = g_response_list[this.index - 1].firstChild; ch != null; ch = ch.nextSibling) {
            if (ch.nodeType == Node.ELEMENT_NODE && ch.nodeName == "SPAN" && ch.className == "KOSHIAN_reply_no") {
                let anchor = document.createElement("a");
                anchor.href = "javascript:void(0);";
                anchor.className = "KOSHIAN_reply_no";
                anchor.title = "このレスに移動";
                anchor.innerText = `[${ch.innerText}]`;
                anchor.addEventListener("click", () => {
                    this.mouseon = false;
                    this.hide();
                    moveToResponse(ch);
                }, false);
                this.popup.appendChild(anchor);
            } else if (ch.nodeType == Node.ELEMENT_NODE && ch.className == "KOSHIAN_ReplyNo") {
                let clone = ch.cloneNode(true);
                clone.className = "KOSHIAN_PopupReply";
                this.popup.appendChild(clone);
            } else if (ch.nodeType == Node.ELEMENT_NODE && ch.nodeName == "INPUT" && ch.id) {
                let clone = ch.cloneNode(true);
                clone.id = ch.id + "_";
                this.popup.appendChild(clone);
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
        this.popup.style.zIndex = 1;
        this.popup.style.width = "auto";
        this.popup.style.maxWidth = "initial";
        if (popup_font_size) {
            this.popup.style.fontSize = `${popup_font_size}px`;
            // ポップアップ内のKOSHIAN画像保存ボタンにフォントサイズを再設定
            let image_save_button = this.popup.getElementsByClassName("KOSHIAN_SaveButton")[0];
            if (image_save_button && image_save_button.style.fontSize) {
                let button_font_size = parseInt(image_save_button.style.fontSize, 10);
                if (button_font_size > popup_font_size) {
                    image_save_button.style.fontSize = `${popup_font_size}px`;
                }
            }
        } else {
            this.popup.style.fontSize = "";
        }
        this.green_text.appendChild(this.popup);

    }

    show(e) {
        this.createPopup();

        if (this.popup) {
            let rc = Reply.getPopupPosition(e.clientX, e.clientY, this.green_text);

            this.popup.style.top = `${rc.top + rc.height - 2}px`;
            let popup_left = rc.left + popup_indent;
            this.popup.style.left = "0px";
            this.popup.style.right = "";
            this.popup.style.display = "block";

            // 測定前にサムネ画像倍率を反映
            let popup_imgs = this.popup.getElementsByTagName("img");
            for (let popup_img of popup_imgs) {
                let popup_img_rect = popup_img.getBoundingClientRect();
                if (popup_img_rect.width && popup_img_rect.height) {
                    popup_img.width = popup_img_rect.width * popup_img_scale / 100;
                    popup_img.height = popup_img_rect.height * popup_img_scale / 100;
                } else if (popup_img.style.maxWidth && popup_img.style.maxHeight) {
                    popup_img.style.maxWidth = `${parseInt(popup_img.style.maxWidth, 10) * popup_img_scale / 100}px`;
                    popup_img.style.maxHeight = `${parseInt(popup_img.style.maxHeight, 10) * popup_img_scale / 100}px`;
                } else {
                    continue;
                }
                let blockquote = popup_img.parentNode.nextElementSibling;
                if (blockquote && blockquote.tagName == "BLOCKQUOTE") {
                    let margin_left = blockquote.style.marginLeft;
                    if (margin_left && popup_img.width) {
                        // コメントの左マージンをサムネ画像倍率に合わせる
                        blockquote.style.marginLeft = `${popup_img.width + 40}px`;
                    }
                }
            }

            // ポップアップが画面右端からはみ出る時は右端にそろえる
            let popup_rect = this.popup.getBoundingClientRect();
            let doc_width = document.documentElement.clientWidth;
            let window_right = doc_width + document.documentElement.scrollLeft;
            if (popup_left + popup_rect.width > window_right) {
                if (doc_width < popup_rect.width) {
                    this.popup.style.maxWidth = `${doc_width}px`;
                    this.popup.style.minWidth = `${doc_width}px`;
                }
                this.popup.style.left = "";
                this.popup.style.right = "0px";
            } else {
                this.popup.style.left = `${popup_left}px`;
            }

            let number_button = this.popup.getElementsByClassName("KOSHIAN_NumberButton")[0];
            if (number_button) {
                // KOSHIAN 引用メニュー 改のNo.ボタンのclassを書換
                number_button.className = "KOSHIAN_PopupNumber";
            }

            let hide_button = this.popup.getElementsByClassName("KOSHIAN_HideButton")[0];
            if (hide_button) {
                //hide_button.className = "KOSHIAN_PopupHide";
                // KOSHIAN NG 改の[隠す]ボタンを削除
                hide_button.remove();
            }

            let ng_switch = this.popup.getElementsByClassName("KOSHIAN_NGSwitch")[0];
            if (ng_switch) {
                //ng_switch.className = "KOSHIAN_PopupNG";
                // KOSHIAN NG 改の[NGワード]ボタンを削除
                ng_switch.remove();
            }

            let save_button = this.popup.getElementsByClassName("KOSHIAN_SaveButton")[0];
            if (save_button) {
                // KOSHIAN 画像保存ボタンの[保存]ボタンのclassを書換
                save_button.className = "KOSHIAN_PopupSave";
            }

            let preview_switches = this.popup.getElementsByClassName("KOSHIAN_PreviewSwitch");
            while (preview_switches.length) {
                // KOSHIAN 自動リンク生成の[隠す]ボタンを削除
                preview_switches[0].remove();
            }

            document.dispatchEvent(new CustomEvent("KOSHIAN_popupQuote"));
        }
    }

    hide() {
        if (this.popup) {
            this.popup.remove();
        }
    }

    static getPopupPosition(mouse_client_x, mouse_client_y, elem) {
        let rc = {};

        let clientH = document.documentElement.clientHeight;
        let elem_position = elem.getBoundingClientRect();

        rc.left = (elem_position.left + document.documentElement.scrollLeft);
        rc.top = clientH - (elem_position.bottom + document.documentElement.scrollTop); // elemの下辺をtopにする
        rc.width = elem.width;
        rc.height = elem.height;

        return rc;
    }

}

function putIndex(rtd, index) {
    if (rtd.firstElementChild.className != "KOSHIAN_reply_no") {
        let reply = document.createElement("span");
        reply.id = `KOSHIAN_reply_no${index}`;
        reply.className = "KOSHIAN_reply_no";
        reply.textContent = `${index}`;
        reply.style.color = `#601010`;
        if (index == 0) {
            reply.style.display = "none";
        }

        rtd.insertBefore(reply, rtd.firstChild);
    }
}

function createPopup(rtd, index) {
    if (search_reply) {
        let previous_index = -1, previous_quote = null;
        for (let i = 0, font_elements = rtd.getElementsByTagName("font"); i < font_elements.length; ++i) {
            if (font_elements[i].color == QUOTE_COLOR) {
                let quote = new Quote(font_elements[i], index, 0, null);
                let origin_index = quote.findOriginIndex(true);
                if (origin_index > -1 && origin_index != previous_index) {
                    putReplyNo(origin_index, index);
                    if (previous_index > -1) {
                        // 引用元に前回探索した引用の引用元が存在したときは前回設置した返信No.を削除する
                        let previous_quote_index = previous_quote.findOriginIndex(true, origin_index);
                        if (previous_quote_index > -1) {
                            removeReplyNo(previous_index);
                        }
                    }
                    previous_index = origin_index;
                    previous_quote = quote;
                }
            }
        }
    } else {
        for(let i = 0,font_elements = rtd.getElementsByTagName("font"); i < font_elements.length; ++i){
            if(font_elements[i].color == QUOTE_COLOR){
                new Quote(font_elements[i], index, 0, null);
            }
        }
    }
}

function putReplyNo(origin_index, index) {
    let reply_no = document.createElement("span");
    reply_no.className = "KOSHIAN_ReplyNo";
    reply_no.textContent = `>>${index}`;
    reply_no.style.color = REPLY_COLOR;

    let response, reply_no_list, ng_button;
    if (origin_index) {
        // レス
        response = g_response_list[origin_index - 1];
        reply_no_list = response.getElementsByClassName("KOSHIAN_ReplyNo");
        ng_button = response.getElementsByClassName("KOSHIAN_HideButton")[0] || response.getElementsByClassName("KOSHIAN_NGSwitch")[0];
    } else {
        // スレ
        response = g_thre;
        reply_no_list = document.querySelectorAll(".thre > .KOSHIAN_ReplyNo");
        ng_button = null;
    }
    let target;
    if (reply_no_list.length) {
        target = reply_no_list[reply_no_list.length - 1].nextSibling;
    } else if (ng_button) {
        target = ng_button.nextSibling;
    } else if (have_sod) {
        target = response.getElementsByClassName("sod")[0].nextSibling;
    } else if (have_del) {
        target = response.getElementsByClassName("del")[0].nextSibling;
    } else {
        target = response.getElementsByTagName("blockquote")[0];
    }
    response.insertBefore(reply_no, target);
    response.insertBefore(document.createTextNode(" "), reply_no);
    new Reply(reply_no, index);
}

function removeReplyNo(index) {
    let response, reply_no_list;
    if (index) {
        // レス
        response = g_response_list[index - 1];
        reply_no_list = response.getElementsByClassName("KOSHIAN_ReplyNo");
    } else {
        // スレ
        response = g_thre;
        reply_no_list = document.querySelectorAll(".thre > .KOSHIAN_ReplyNo");
    }
    if (reply_no_list.length) {
        let target = reply_no_list[reply_no_list.length - 1];
        response.removeChild(target.previousSibling);   // 空白テキスト
        response.removeChild(target);
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

    let reply_no_list = g_thre.getElementsByClassName("KOSHIAN_ReplyNo");
    while (reply_no_list.length) {
        reply_no_list[0].remove();
    }

    let response_list = g_thre.getElementsByClassName("KOSHIAN_Response");
    while (response_list.length) {
        response_list[0].remove();
    }

    g_response_list = g_thre.getElementsByClassName("rtd");
    have_sod = document.getElementsByClassName("sod").length > 0;
    have_del = document.getElementsByClassName("del").length > 0;

    // add search targets by thre
    search_targets.push(SearchTarget.createByThre(g_thre));
    putIndex(g_thre, 0);

    process(0, g_response_list.length);
    g_last_response_num = g_response_list.length;

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);

    // KOSHIAN リロード監視
    document.addEventListener("KOSHIAN_reload", () => {
        let prev_res_num = g_last_response_num;
        let cur_res_num = g_response_list.length;
        process(prev_res_num, cur_res_num);
        g_last_response_num = cur_res_num;
    });

    // ふたば リロード監視
    let contdisp = document.getElementById("contdisp");
    if (contdisp) {
        checkFutabaReload(contdisp);
    }

    function checkFutabaReload(target) {
        let status = "";
        let reloading = false;
        let config = { childList: true };
        let observer = new MutationObserver(function() {
            if (target.textContent == status) {
                return;
            }
            status = target.textContent;
            if (status == "・・・") {
                reloading = true;
            } else if (reloading && status.endsWith("頃消えます")) {
                let prev_res_num = g_last_response_num;
                let cur_res_num = g_response_list.length;
                process(prev_res_num, cur_res_num);
                g_last_response_num = cur_res_num;
                reloading = false;
            } else {
                reloading = false;
            }
        });
        observer.observe(target, config);
    }
}

function onMouseDown(e) {
    if (e.button != 0 || !search_selected_length) {
        return;
    }
    if (e.target.className == "KOSHIAN_selected_font") {
        // 左ボタン押下場所が選択文字列のfont要素ならテキスト置換中止
        return;
    }

    // 選択文字列のfont要素だけを削除（font要素の子要素は残す）
    let koshian_response = e.target.closest(".KOSHIAN_response");
    unwrap(koshian_response, "KOSHIAN_selected_font");
    selected_elm = null;
}

function onMouseUp(e) {
    if (e.button != 0 || (!selected_elm && !search_selected_length)) {
        return;
    }
    if (e.target.className == "KOSHIAN_selected_font") {
        // 左ボタンを離した場所が選択文字列のfont要素上なら中止
        return;
    }

    // 選択文字列のfont要素だけを削除（font要素の子要素は残す）
    let koshian_response = e.target.closest(".KOSHIAN_response");
    unwrap(koshian_response, "KOSHIAN_selected_font");
    selected_elm = null;

    if (!search_selected_length) {
        return;
    }

    let sel = window.getSelection();
    let sel_str = sel.toString();
    if (sel_str.length < search_selected_length ||
        sel_str.match(/\r|\n/) ||
        sel.rangeCount > 1) {
        return;
    }
    let sel_elm = sel.anchorNode;
    if (sel_elm.nodeName != "BLOCKQUOTE") {
        sel_elm = sel_elm.parentNode;
        if (!isInsideBlockquote(sel_elm)) {
            // 選択場所がレス本文以外なら中止
            return;
        }
    }

    let font_elm = document.createElement("font");
    font_elm.classList.add("KOSHIAN_selected_font");
    font_elm.style.color = "red";
    font_elm.style.backgroundColor = "#FFFFEE";
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
        // レス本文内IP表示対応
        let sel_start = sel_range.startContainer;
        let sel_start_offset = sel_range.startOffset;
        let has_left_bracket = false;
        if (sel_start.nodeType == Node.TEXT_NODE) {
            if (sel_start.length == sel_start_offset &&
                sel_start.nextSibling == sel_start.nextElementSibling) {
                // 選択始点がテキストノードの終点で次のノードが要素の場合
                // 選択始点を要素の最初の子ノードの前に移動
                sel_range.setStartBefore(sel_start.nextSibling.firstChild);
            } else if (sel_start.nodeValue == "[" && sel_start.nextSibling.nodeName == "FONT") {
                // 選択始点がIP表示の"["の場合、選択始点を"["の後に移動
                sel_range.setStartBefore(sel_start.nextSibling.firstChild);
                has_left_bracket = true;
            }
        }
        let sel_end = sel_range.endContainer;
        let sel_end_offset = sel_range.endOffset;
        let has_right_bracket = false;
        if (sel_end.nodeType == Node.TEXT_NODE &&
            sel_end.nodeValue == "]" &&
            sel_end.previousSibling.nodeName == "FONT") {
            // 選択終点がIP表示の"]"の場合、選択終点を"]"の前に移動
            sel_range.setEndAfter(sel_end.previousSibling.lastChild);
            has_right_bracket = true;
        }
        try {
            sel_range.surroundContents(font_elm);
            // 移動した選択範囲を元に戻す
            if (has_left_bracket) {
                sel_range.setStart(sel_start, sel_start_offset);
            }
            if (has_right_bracket) {
                sel_range.setEnd(sel_end, sel_end_offset);
            }
        } catch(e) {
            console.error ("KOSHIAN_popup_quote/res.js - surround contents error: " + e);   // eslint-disable-line no-console
        }
    } finally {
        selected_elm = sel_elm.getElementsByClassName("KOSHIAN_selected_font")[0];
        let selected_index = 0;
        if (selected_elm) {
            let res_elm = sel_elm.closest(".rtd, .KOSHIAN_response");
            if (res_elm) {
                let selected_reply_no = res_elm.getElementsByClassName("KOSHIAN_reply_no")[0];
                if (selected_reply_no) {
                    let match = selected_reply_no.innerText.match(/\d+/);
                    if (match) {
                        selected_index = parseInt(match[0], 10);
                    }
                }
            }
            if (selected_index) {
                new Quote(selected_elm, selected_index, selected_depth, selected_parent_list[selected_depth], true);
            }
        }
    }
}

/**
 * 要素のテキストを指定したクラス名のテキストを除外して取得
 * @param {Element} element テキストを取得する要素
 * @param {string} class_name テキスト取得を除外するクラス名
 * @return {string} 取得したテキスト
 */
function getInnerText(element, class_name) {
    let text = "";
    if (!element) {
        return text;
    }
    for (let node = element.firstChild; node; node = node.nextSibling) {
        if (node.className == class_name) {
            continue;
        } else if (node.nodeName == "A") {
            // aタグは更に子ノードのテキストを取得（FTBucketの外部リンク対策）
            text += getInnerText(node, class_name);
        } else if (node.nodeName == "BR") {
            text += "\n";
        } else {
            text += node.textContent;
        }
    }
    return text;
}

/**
 * 指定したクラス名の要素を子要素は残して削除
 * @param {Element} element 削除する対象の要素
 *     要素がnullのときはdocument全体が対象
 * @param {string} class_name 子要素を残して削除する要素のクラス名
 */
function unwrap(element, class_name) {
    element = element ? element : document;
    let elements = element.getElementsByClassName(class_name);
    for (let i = 0, num = elements.length; i < num; ++i) {
        while (elements[i].firstChild) {
            elements[i].parentNode.insertBefore(elements[i].firstChild, elements[i]);
        }
        elements[i].remove();
    }
}

/**
 * 指定した要素がBlockquote内か
 * @param {Element} element Blockquote内か確認する要素
 */
function isInsideBlockquote(element){
    return element.closest("blockquote") !== null;
}

/**
 * 指定したレス番号へスクロール
 * @param {Element} replyNo_elm レス番号の要素
 */
function moveToResponse(replyNo_elm){
    let target = replyNo_elm.parentNode;
    if (replyNo_elm.id == "KOSHIAN_reply_no0") {
        target = target.getElementsByTagName("blockquote")[0];
    }
    if (target) {
        target.scrollIntoView({block: "center"});
        target.style.backgroundColor = "#ffcc99";
        setTimeout(() => {
            target.style.backgroundColor = "";
        }, 2000);
    }
}

function safeGetValue(value, default_value) {
    return value === undefined ? default_value : value;
}

function onError(error) {   // eslint-disable-line no-unused-vars

}

function onLoadSetting(result) {
    search_resno = safeGetValue(result.search_resno, DEFAULT_SEARCH_RESNO);
    search_file = safeGetValue(result.search_file, DEFAULT_SEARCH_FILE);
    popup_time = Number(safeGetValue(result.popup_time, DEFAULT_POPUP_TIME));
    popup_indent = Number(safeGetValue(result.popup_indent, DEFAULT_POPUP_INDENT));
    popup_todown = safeGetValue(result.popup_todown, DEFAULT_POPUP_TODOWN);
    popup_near = safeGetValue(result.popup_near, DEFAULT_POPUP_NEAR);
    popup_perfect = safeGetValue(result.popup_perfect, DEFAULT_POPUP_PERFECT);
    search_selected_length = Number(safeGetValue(result.search_selected_length, DEFAULT_SEARCH_SELECTED_LENGTH));
    search_reply = safeGetValue(result.search_reply, DEFAULT_SEARCH_REPLY);
    popup_font_size = Number(safeGetValue(result.popup_font_size, DEFAULT_POPUP_FONT_SIZE));
    popup_img_scale = Number(safeGetValue(result.popup_img_scale, DEFAULT_POPUP_IMG_SCALE));

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
    popup_near = safeGetValue(changes.popup_near.newValue, DEFAULT_POPUP_NEAR);
    popup_perfect = safeGetValue(changes.popup_perfect.newValue, DEFAULT_POPUP_PERFECT);
    search_selected_length = Number(safeGetValue(changes.search_selected_length.newValue, DEFAULT_SEARCH_SELECTED_LENGTH));
    search_reply = safeGetValue(changes.search_reply.newValue, DEFAULT_SEARCH_REPLY);
    popup_font_size = Number(safeGetValue(changes.popup_font_size.newValue, DEFAULT_POPUP_FONT_SIZE));
    popup_img_scale = Number(safeGetValue(changes.popup_img_scale.newValue, DEFAULT_POPUP_IMG_SCALE));
}

browser.storage.local.get().then(onLoadSetting, onError);
browser.storage.onChanged.addListener(onSettingChanged);