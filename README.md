## KOSHIAN 引用をポップアップで表示 改
このFirefoxアドオンは[Pachira](https://addons.mozilla.org/ja/firefox/user/anonymous-a0bba9187b568f98732d22d51c5955a6/)氏の[KOSHIAN 引用をポップアップで表示](https://addons.mozilla.org/ja/firefox/addon/koshian-popup-quote/)アドオンを改変したものです。  
レス内の選択文字列の引用元をポップアップ表示する機能を追加しました。  

※このアドオンはWebExtensionアドオン対応のFirefox専用となります。  
※他のKOSHIANアドオン改変版やUserscriptは[こちら](https://github.com/akoya-tomo/futaba_auto_reloader_K/wiki)の一覧からどうぞ  

## 機能
* オリジナルの機能（KOSHIAN 引用をポップアップで表示）  
  - ふたば☆ちゃんねるのスレ画面で引用元をポップアップで表示します  
* 追加された機能（KOSHIAN 引用をポップアップで表示 改）  
  - レス内の選択文字列の引用元をポップアップ表示する機能  
    レス内の選択文字列にマウスオーバーすると、選択文字列の引用元をポップアップ表示します。  
    引用符の無い画像番号やレス番号の引用元を確認したいときなどに便利です。  

## インストール
[GitHub](https://github.com/akoya-tomo/koshian_popup_quote_kai/releases/download/v1.0.0/koshian_popup_quote_kai-1.0.0-an.fx.xpi)  

## 設定
機能の設定はアドオンのオプション画面から変更できます。  

* x文字以上の選択した文字列の引用を探す（デフォルト：0 = 無効）  
  - レス内の選択した文字列が設定した文字数以上の時に引用元を探してポップアップします。  
    0で機能が無効になります。  
    短い選択文字列にマウスオーバーしてポップアップするのが煩わしいときは大きめの数字を設定してください。  

## 注意事項  
* このアドオンはWebExtensionアドオン対応のFirefox専用です。  
* [KOSHIAN 自動リンク生成](https://addons.mozilla.org/ja/firefox/addon/koshian-autolink-futaba/)のv1.2以前と組み合わせては使えません。  
  [KOSHIAN 自動リンク生成](https://addons.mozilla.org/ja/firefox/addon/koshian-autolink-futaba/) v1.3以上または[KOSHIAN 自動リンク生成 改](https://github.com/akoya-tomo/koshian_autolink_futaba_kai/)と組み合わせてご使用ください。  
* 文字列選択で引用ポップアップするのはレス内の本文のみです。  
  題名・なまえ・ID・IPやファイル名を文字列選択してもポップアップしません。  
* 複数行に跨る文字列選択ではポップアップしません。  
* ポップアップしたレスから更に文字列選択してポップアップすることはできません。  
  文字列選択してポップアップしたレスから更に引用符付きレス文のポップアップは可能です。  
* オリジナル版とは別アドオンなので設定は初期値に戻ります。  
  再度設定をお願い致します。  

## 今後の予定  
以下の機能について検討しています。  

* レス番号の「No.」やファイル名の拡張子を自動的に補完して探索  
* ポップアップしたレスにも文字列選択で更にポップアップ  

## 更新履歴  
* v1.0.0 2018-01-11  
  - KOSHIAN 引用をポップアップで表示 v1.3.1ベース  
  - レス内の選択文字列の引用元をポップアップ表示する機能を追加  
