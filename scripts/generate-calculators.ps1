# Generates minimal calculator shell HTML pages (logic lives in calculator-registry.js)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function New-CalcShell($file, $title, $id) {
    $html = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="css/corporate.css">
    <script src="js/site-layout.js" defer></script>
    <title>$title | Engineering Knowledge</title>
</head>
<body class="calculator-page" data-calc="$id">
</body>
</html>
"@
    Set-Content (Join-Path $root $file) $html -Encoding UTF8 -NoNewline
    Write-Host "Created $file (data-calc=$id)"
}

# Example: add new calculators here, then define compute/fields/help in js/calculator-registry.js
# New-CalcShell 'example_calculator.html' 'Example Calculator' 'example'

Write-Host "Done. Register new calculators in js/calculator-registry.js"
