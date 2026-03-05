說明：直接用 `file:///` 開啟以及設定開機自動啟動

1) 直接以檔案方式開啟
- 在檔案總管中雙擊 `index.html`，或在瀏覽器位址列輸入：

  file:///D:/楊志鴻/單字例句助手/index.html

- 我已在專案根目錄新增 `start_app.bat`，內容會用系統預設瀏覽器開啟上述路徑：

  `start_app.bat`（雙擊即可）

2) 把程式設為「開機時自動啟動」
- 建議做法（使用 PowerShell 建立一個指向 `start_app.bat` 的捷徑到使用者的 Startup 資料夾）：

  打開 PowerShell（以一般權限即可），貼上並執行以下指令：

```powershell
$startup = [Environment]::GetFolderPath("Startup")
$target = "D:\楊志鴻\單字例句助手\start_app.bat"
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut("$startup\\單字例句助手.lnk")
$lnk.TargetPath = $target
$lnk.WorkingDirectory = "D:\楊志鴻\單字例句助手"
$lnk.IconLocation = "explorer.exe,0"
$lnk.Save()
```

- 執行後，重新啟動電腦即可在登入時自動開啟該 `start_app.bat`，進而在預設瀏覽器載入 `index.html`。

3) 注意事項與限制
- 若你在網頁中使用 Gemini 等外部 API：
  - 部分瀏覽器或 API 會對從 `file://` 發出的跨域請求（CORS）有嚴格限制，可能導致 API 請求失敗（例如被瀏覽器封鎖或被 API 端拒絕）。
  - 若發生此問題，建議改以本機 HTTP 伺服器啟動（較穩定）：

    ```powershell
    cd "D:\楊志鴻\單字例句助手"
    python -m http.server 8000
    ```

    然後開啟 http://localhost:8000 。

- 若你想直接讓系統在開機時啟動某個特定瀏覽器（例如 Chrome）並載入 `index.html`，可改為建立一個啟動 Chrome 的捷徑，示範（需依你電腦上 Chrome 路徑調整）：

```powershell
$startup = [Environment]::GetFolderPath("Startup")
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut("$startup\\單字例句助手 - Chrome.lnk")
$lnk.TargetPath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
$lnk.Arguments = "file:///D:/楊志鴻/單字例句助手/index.html"
$lnk.WorkingDirectory = "D:\\楊志鴻\\單字例句助手"
$lnk.IconLocation = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe,0"
$lnk.Save()
```

5) 若要讓內建的 `python -m http.server 8000` 也跟著開機自動啟動，請使用下列檔案：
  - `start_server.cmd`：手動啟動伺服器的批次檔（會自行切換到專案目錄並開新命令視窗執行）。
  - `start_server.vbs`：背景模式啟動批次檔，用於開機自動執行時避免黑色視窗。
  - `install_server_startup.cmd` / `install_server_startup.vbs`：會在使用者的 Startup 資料夾建立一個捷徑，指向 `start_server.vbs`。

  先測試手動啟動伺服器（可另開視窗）：

```powershell
cd "D:\楊志鴻\單字例句助手"
.\start_server.cmd
```

  接著執行安裝腳本（需要寫入 Startup 資料夾），可雙擊 `install_server_startup.cmd` 或：

```powershell
cd "D:\楊志鴻\單字例句助手"
.\install_server_startup.cmd
```

  執行後會顯示新捷徑路徑；下次登入即可自動啟動 `start_server.vbs`，進而在新視窗執行 `python -m http.server 8000`。

  若要移除自動啟動，可手動刪除 `%AppData%\Microsoft\Windows\Start Menu\Programs\Startup\單字例句助手 - Server.lnk`。

  6) 如何停止伺服器與移除自動啟動（快速步驟）
  - 若伺服器正在執行（先前以 `start_server.cmd` 或自動啟動啟動），可以執行專案中的 `stop_server.cmd`：

  ```powershell
  cd "D:\楊志鴻\單字例句助手"
  .\stop_server.cmd
  ```

    這個指令會透過 PowerShell 找出 command line 含 `http.server` 或 `python -m http.server` 的進程並強制關閉。

  - 若想移除啟動時的捷徑（取消開機自動啟動），請執行：

  ```powershell
  cd "D:\楊志鴻\單字例句助手"
  .\uninstall_server_startup.cmd
  ```

    該腳本會刪除 Startup 資料夾中的 `單字例句助手 - Server.lnk`（與先前可能建立的 `單字例句助手.lnk`）。

4) 如果你希望我直接幫你：
- 我可以把 `start_app.bat` 的路徑或內容改為你偏好的瀏覽器，或產生上述 PowerShell 快捷建立腳本檔（`.ps1`）。
- 或者我可以幫你把 README 裡的指令改成繁體中文教學步驟截圖版。