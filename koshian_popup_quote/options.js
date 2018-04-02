const DEFAULT_SEARCH_RESNO = true;
const DEFAULT_SEARCH_FILE = true;
const DEFAULT_POPUP_TIME = 100;
const DEFAULT_POPUP_INDENT = 0;
const DEFAULT_POPUP_TODOWN = false;
const DEFAULT_SEARCH_SELECTED_LENGTH = 0;
const DEFAULT_USE_FUTABA_LIGHTBOX = false;

function safeGetValue(value, default_value) {
  return value === undefined ? default_value : value;
}

function onError(error) {
}

function saveOptions(e) {
  e.preventDefault();

  browser.storage.local.set({
    search_resno: document.querySelector("#search_resno").checked,
    search_file: document.querySelector("#search_file").checked,
    popup_time: document.querySelector("#popup_time").value,
    popup_indent: document.querySelector("#popup_indent").value,
    popup_todown: document.querySelector("#popup_todown").checked,
    search_selected_length: document.querySelector("#search_selected_length").value,
    use_futaba_lightbox: document.querySelector("#use_futaba_lightbox").checked
  });
}

function setCurrentChoice(result) {
  document.querySelector("#search_resno").checked = safeGetValue(result.search_resno, DEFAULT_SEARCH_RESNO);
  document.querySelector("#search_file").checked = safeGetValue(result.search_file, DEFAULT_SEARCH_FILE);
  document.querySelector("#popup_time").value = safeGetValue(result.popup_time, DEFAULT_POPUP_TIME);
  document.querySelector("#popup_indent").value = safeGetValue(result.popup_indent, DEFAULT_POPUP_INDENT);
  document.querySelector("#popup_todown").checked = safeGetValue(result.popup_todown, DEFAULT_POPUP_TODOWN);
  document.querySelector("#search_selected_length").value = safeGetValue(result.search_selected_length, DEFAULT_SEARCH_SELECTED_LENGTH);
  document.querySelector("#use_futaba_lightbox").checked = safeGetValue(result.use_futaba_lightbox, DEFAULT_USE_FUTABA_LIGHTBOX);

  document.querySelector("#save_button").addEventListener("click", saveOptions);
}

function restoreOptions() {
  browser.storage.local.get().then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
