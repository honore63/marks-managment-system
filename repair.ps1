$files = @('frontend/src/components/import-engine.js', 'frontend/src/components/import-ui.js')
foreach ($file in $files) {
    if (Test-Path $file) {
        $json = Get-Content $file -Raw
        try {
            $code = $json | ConvertFrom-Json
            if ($code) {
                [IO.File]::WriteAllText($file, $code, [System.Text.Encoding]::UTF8)
                Write-Host "Repaired $file"
            }
        } catch {
            Write-Host "Failed to parse $file"
        }
    }
}
