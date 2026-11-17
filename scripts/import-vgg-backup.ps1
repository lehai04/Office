param(
    [Parameter(Mandatory)][string]$BackupPath,
    [Parameter(Mandatory)][string]$ApiOrigin
)

$ErrorActionPreference = 'Stop'
$node = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($node) { $node.Source } else { 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) { throw 'Node.js was not found.' }

function Read-SecretBase64([string]$Prompt) {
    $secret = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer))
        try { [Convert]::ToBase64String($bytes) } finally { [Array]::Clear($bytes, 0, $bytes.Length) }
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $secret.Dispose()
    }
}

$inputData = @{
    passphrase = Read-SecretBase64 'Nhap mat khau tep sao luu'
    token = Read-SecretBase64 'Nhap ma nhap du lieu Office do ban quan ly'
}
try {
    $inputData | ConvertTo-Json -Compress |
        & $nodePath (Join-Path $PSScriptRoot 'import-vgg-backup.mjs') $BackupPath $ApiOrigin
    if ($LASTEXITCODE -ne 0) { throw 'Office import failed.' }
} finally {
    $inputData.Clear()
}
