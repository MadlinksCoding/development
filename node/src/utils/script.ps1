 = Get-Content Logger.js
 = 0
for ( = 0;  -lt .Length; ++) {
    if ([] -match 'static async writeLog') {
         = 
        break
    }
}
 = .Length
for ( =  + 1;  -lt .Length; ++) {
    if ([] -match '^  static async writeLogs') {
         = 
        break
    }
}
[..( - 1)]
