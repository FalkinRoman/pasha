@echo off
REM ===================================================================
REM  stopKEK - RESTORE kiosk restrictions after servicing.
REM  Turns ON: Task Manager, regedit, Run dialog, Control Panel,
REM  Win+L (Lock Workstation), Change Password  -> all blocked again.
REM
REM  Double-click WHILE LOGGED IN AS THE 'player' account.
REM  Writes the player's own HKCU policy hive - no admin / UAC needed.
REM ===================================================================
set "SYS=HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System"
set "EXP=HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer"

reg add "%SYS%" /v DisableTaskMgr /t REG_DWORD /d 1 /f
reg add "%SYS%" /v DisableRegistryTools /t REG_DWORD /d 1 /f
reg add "%SYS%" /v DisableLockWorkstation /t REG_DWORD /d 1 /f
reg add "%SYS%" /v DisableChangePassword /t REG_DWORD /d 1 /f
reg add "%EXP%" /v NoRun /t REG_DWORD /d 1 /f
reg add "%EXP%" /v NoControlPanel /t REG_DWORD /d 1 /f

REM Best-effort: make Explorer re-read NoRun / NoControlPanel without a sign-out.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$q=[char]34; $sig='[DllImport('+$q+'user32.dll'+$q+',SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr h,int m,IntPtr w,string l,int f,int t,out IntPtr r);'; $x=Add-Type -MemberDefinition $sig -Name W -Namespace P -PassThru; $rr=[IntPtr]::Zero; [void]$x::SendMessageTimeout([IntPtr]0xffff,0x1A,[IntPtr]::Zero,'Policy',2,2000,[ref]$rr)"

echo.
echo   LOCKED - Task Manager / regedit / Run / Control Panel blocked.
echo.
pause
