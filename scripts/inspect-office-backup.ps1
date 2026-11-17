param(
    [Parameter(Mandatory)]
    [string]$BackupPath
)

$ErrorActionPreference = 'Stop'
$node = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($node) { $node.Source } else { 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) { throw 'Node.js was not found.' }

$secret = Read-Host 'Nhap mat khau tep sao luu Office' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
    $bytes = [Text.Encoding]::UTF8.GetBytes([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer))
    try {
        [Convert]::ToBase64String($bytes) | & $nodePath (Join-Path $PSScriptRoot 'inspect-office-backup.mjs') $BackupPath
        if ($LASTEXITCODE -ne 0) { throw 'Office backup inspection failed.' }
    } finally {
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $secret.Dispose()
}
