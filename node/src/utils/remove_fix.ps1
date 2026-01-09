 = Get-Content Logger.js -Raw
 = [regex]::Replace(,'\\s*\\(fix #[^\\)]+\\)','')
Set-Content Logger.js -Value 
