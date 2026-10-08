# onedrive-update-urls.ps1
#
# Le os arquivos .xlsx da pasta sincronizada do OneDrive no Explorer e gera
# SQL com UPDATE de cart_url_plan_analitica. Nao precisa de autenticacao.
#
# EXECUCAO:
#   powershell -ExecutionPolicy Bypass -File onedrive-update-urls.ps1
#
# SAIDA:
#   update_onedrive_urls.sql  -- rodar no Supabase SQL Editor
#   unmatched.txt             -- arquivos fora do padrao de nome (revisar)

# ---- CONFIGURACAO --------------------------------------------------------

# Pasta local onde os arquivos estao (subpastas por mes dentro dela)
# Ajuste o nome de usuario se necessario
$LocalFolder = "$env:USERPROFILE\OneDrive - Sinqia\_PUBLICO\CARTEIRA"

# URL base do SharePoint que corresponde ao OneDrive sincronizado.
# Formato: https://{tenant}-my.sharepoint.com/personal/{usuario}/Documents
# Tudo apos "OneDrive - Sinqia\" no caminho local vira o restante da URL.
$SharePointBase = "https://sinqiacloud-my.sharepoint.com/personal/carlos_asribeiro_evertecinc_com_br/Documents"

$OutputSql     = "$PSScriptRoot\update_onedrive_urls.sql"
$UnmatchedPath = "$PSScriptRoot\unmatched.txt"

# ---- FIM CONFIGURACAO ----------------------------------------------------

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $LocalFolder)) {
    Write-Error "Pasta nao encontrada: $LocalFolder`nAjuste `$LocalFolder no script."
}

Write-Host "Lendo arquivos em: $LocalFolder"
$allFiles = Get-ChildItem -Path $LocalFolder -Recurse -Filter "*.xlsx"
Write-Host "Encontrados: $($allFiles.Count) arquivos .xlsx"
Write-Host ""

$sqlLines  = [System.Collections.Generic.List[string]]::new()
$unmatched = [System.Collections.Generic.List[string]]::new()
$matched   = 0

$sqlLines.Add("-- Gerado em $(Get-Date -Format 'yyyy-MM-dd HH:mm') por onedrive-update-urls.ps1")
$sqlLines.Add("-- Cada UPDATE casa pelo cart_nome_plan_analitica (coluna gerada no banco).")
$sqlLines.Add("-- Rode antes no Supabase para conferir duplicatas:")
$sqlLines.Add("-- SELECT cart_nome_plan_analitica, count(*) FROM cart_mes GROUP BY 1 HAVING count(*) > 1;")
$sqlLines.Add("")

foreach ($file in $allFiles) {
    $name      = $file.Name
    $nameNoExt = [System.IO.Path]::GetFileNameWithoutExtension($name)

    # Extrai prefixo canonico: tudo ate o segundo bloco de data YYYY-MM-DD
    # Ex.: "7s_websec_Medicao_2026-08-01_2026-08-31_digital" -> "7s_websec_Medicao_2026-08-01_2026-08-31"
    if ($nameNoExt -match '^(.+_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2})') {
        $base = $Matches[1]

        # Constroi URL do SharePoint a partir do caminho relativo dentro da pasta sincronizada
        # Ex.: ...\CARTEIRA\2026-08\arquivo.xlsx -> /_PUBLICO/CARTEIRA/2026-08/arquivo.xlsx
        $oneDriveRoot  = "$env:USERPROFILE\OneDrive - Sinqia"
        $relativePath  = $file.FullName.Substring($oneDriveRoot.Length).Replace("\", "/")
        $sharePointUrl = $SharePointBase.TrimEnd("/") + $relativePath

        $escaped = $sharePointUrl -replace "'", "''"
        $sqlLines.Add("UPDATE carteira")
        $sqlLines.Add("  SET cart_url_plan_analitica = '$escaped'")
        $sqlLines.Add("  WHERE cart_nome_plan_analitica LIKE '$base%'; -- $name")
        $sqlLines.Add("")
        $matched++
        Write-Host "OK: $name" -ForegroundColor Green
    } else {
        $unmatched.Add("NOME_INVALIDO | $($file.FullName)")
        Write-Host "NOME FORA DO PADRAO: $name" -ForegroundColor Yellow
    }
}

$sqlLines | Set-Content $OutputSql -Encoding UTF8

Write-Host ""
Write-Host "=== RESULTADO ===" -ForegroundColor Cyan
Write-Host "UPDATE gerados : $matched"            -ForegroundColor Green
Write-Host "Fora do padrao : $($unmatched.Count)" -ForegroundColor $(if ($unmatched.Count -gt 0) {"Yellow"} else {"Green"})
Write-Host "SQL salvo em   : $OutputSql"

if ($unmatched.Count -gt 0) {
    $unmatched | Set-Content $UnmatchedPath -Encoding UTF8
    Write-Host "Fora do padrao : $UnmatchedPath"
}

Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. Abra $OutputSql e confira alguns UPDATEs"
Write-Host "  2. Rode o SELECT de diagnostico do topo no Supabase primeiro"
Write-Host "  3. Rode o SQL completo no Supabase SQL Editor"
