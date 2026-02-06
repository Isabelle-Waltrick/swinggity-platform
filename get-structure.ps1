function Show-Tree {
    param(
        [string]$Path = ".",
        [string]$Indent = "",
        [int]$MaxDepth = 10,
        [int]$CurrentDepth = 0
    )
    
    if ($CurrentDepth -ge $MaxDepth) { return }
    
    $items = Get-ChildItem -Path $Path | Where-Object { 
        $_.Name -notmatch '^(node_modules|\.git|\.next|dist|build)$' 
    }
    
    $sortedItems = $items | Sort-Object { -not $_.PSIsContainer }, Name
    
    for ($i = 0; $i -lt $sortedItems.Count; $i++) {
        $item = $sortedItems[$i]
        $isLast = ($i -eq $sortedItems.Count - 1)
        $prefix = if ($isLast) { "+---" } else { "|---" }
        $childIndent = if ($isLast) { "$Indent    " } else { "$Indent|   " }
        
        if ($item.PSIsContainer) {
            Write-Host "$Indent$prefix$($item.Name)/" -ForegroundColor Cyan
            Show-Tree -Path $item.FullName -Indent $childIndent -MaxDepth $MaxDepth -CurrentDepth ($CurrentDepth + 1)
        } else {
            Write-Host "$Indent$prefix$($item.Name)" -ForegroundColor Gray
        }
    }
}

Write-Host "Project Structure:" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Show-Tree -MaxDepth 10