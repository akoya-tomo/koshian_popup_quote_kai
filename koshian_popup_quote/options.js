const DEFAULT_SEARCH_RESNO = true;
const DEFAULT_SEARCH_FILE = true;
const DEFAULT_POPUP_TIME = 100;
const DEFAULT_POPUP_INDENT = 0;
const DEFAULT_POPUP_TODOWN = false;
const DEFAULT_POPUP_NEAR = false;
const DEFAULT_POPUP_PERFECT = true;
const DEFAULT_SEARCH_SELECTED_LENGTH = 0;
const DEFAULT_SEARCH_REPLY = true;
const DEFAULT_POPUP_FONT_SIZE = 0;
const DEFAULT_POPUP_IMG_SCALE = 100;

/* eslint indent: ["warn", 2] */

function safeGetValue(value, default_value) {
  return value === undefined ? default_value : value;
}

function onError(error) { // eslint-disable-line no-unused-vars
}

function saveOptions(e) {
  e.preventDefault();

  browser.storage.local.set({
    search_resno: document.querySelector("#search_resno").checked,
    search_file: document.querySelector("#search_file").checked,
    popup_time: document.querySelector("#popup_time").value,
    popup_indent: document.querySelector("#popup_indent").value,
    popup_todown: document.querySelector("#popup_todown").checked,
    popup_near: document.querySelector("#popup_near").checked,
    popup_perfect: document.querySelector("#popup_perfect").checked,
    search_selected_length: document.querySelector("#search_selected_length").value,
    search_reply: document.querySelector("#search_reply").checked,
    popup_font_size: document.querySelector("#popup_font_size").value,
    popup_img_scale: document.querySelector("#popup_img_scale").value
  });
}

function setCurrentChoice(result) {
  document.querySelector("#search_resno").checked = safeGetValue(result.search_resno, DEFAULT_SEARCH_RESNO);
  document.querySelector("#search_file").checked = safeGetValue(result.search_file, DEFAULT_SEARCH_FILE);
  document.querySelector("#popup_time").value = safeGetValue(result.popup_time, DEFAULT_POPUP_TIME);
  document.querySelector("#popup_indent").value = safeGetValue(result.popup_indent, DEFAULT_POPUP_INDENT);
  document.querySelector("#popup_todown").checked = safeGetValue(result.popup_todown, DEFAULT_POPUP_TODOWN);
  document.querySelector("#popup_near").checked = safeGetValue(result.popup_near, DEFAULT_POPUP_NEAR);
  document.querySelector("#popup_perfect").checked = safeGetValue(result.popup_perfect, DEFAULT_POPUP_PERFECT);
  document.querySelector("#search_selected_length").value = safeGetValue(result.search_selected_length, DEFAULT_SEARCH_SELECTED_LENGTH);
  document.querySelector("#search_reply").checked = safeGetValue(result.search_reply, DEFAULT_SEARCH_REPLY);
  document.querySelector("#popup_font_size").value = safeGetValue(result.popup_font_size, DEFAULT_POPUP_FONT_SIZE);
  document.querySelector("#popup_img_scale").value = safeGetValue(result.popup_img_scale, DEFAULT_POPUP_IMG_SCALE);

  document.querySelector("#save_button").addEventListener("click", saveOptions);
}

function restoreOptions() {
  browser.storage.local.get().then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
