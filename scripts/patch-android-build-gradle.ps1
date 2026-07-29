param(
  [Parameter(Mandatory = $true)]
  [string]$AppGradlePath
)

$ErrorActionPreference = "Stop"
$text = Get-Content $AppGradlePath -Raw

$replacement = @'
// apps/mobile (evitar que Metro use el package.json del monorepo)
def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()
def entryFilePath = new File(projectRoot, "index.js").absolutePath

react {
    root = file(projectRoot)
    entryFile = file(entryFilePath)
    reactNativeDir = new File(["node", "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()
    hermesCommand = new File(["node", "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/sdks/hermesc/%OS-BIN%/hermesc"
    codegenDir = new File(["node", "--print", "require.resolve('@react-native/codegen/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()
    cliFile = new File(["node", "--print", "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })"].execute(null, rootDir).text.trim())
    bundleCommand = "export:embed"
    autolinkLibrariesWithApp()
}
'@

$pattern = '(?s)def projectRoot = rootDir\.getAbsoluteFile\(\)\.getParentFile\(\)\.getAbsolutePath\(\)\s*/\*\*.*?\*/\s*react \{.*?\n\}'
if ($text -match $pattern) {
  $text = [regex]::Replace($text, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $replacement.TrimEnd() + "`r`n" }, 1)
} elseif ($text -notmatch 'entryFilePath = new File\(projectRoot, "index.js"\)') {
  throw "No se pudo localizar el bloque react {} en $AppGradlePath para parchear"
}

Set-Content -Path $AppGradlePath -Value $text -Encoding UTF8
Write-Host "Patched $AppGradlePath"
