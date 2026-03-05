' start_server.vbs — 顯示隱藏視窗啟動 start_server.cmd
Dim fso, scriptPath, scriptFolder, cmdPath, wsh
Set fso = CreateObject("Scripting.FileSystemObject")
scriptPath = WScript.ScriptFullName
scriptFolder = fso.GetParentFolderName(scriptPath)
cmdPath = fso.BuildPath(scriptFolder, "start_server.cmd")
Set wsh = CreateObject("WScript.Shell")
wsh.Run "cmd /c """ & cmdPath & """", 0, False
