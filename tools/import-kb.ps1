param(
  [Parameter(Mandatory = $true)]
  [string[]]$SourceFiles,

  [string]$OutputDir = ".\data\docs"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ZipEntryText {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.Compression.ZipArchive]$Zip,

    [Parameter(Mandatory = $true)]
    [string]$EntryPath
  )

  $entry = $Zip.Entries | Where-Object { $_.FullName -eq $EntryPath } | Select-Object -First 1
  if (-not $entry) {
    return $null
  }

  $reader = [System.IO.StreamReader]::new($entry.Open())
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

function Get-XmlDocument {
  param(
    [Parameter(Mandatory = $true)]
    [string]$XmlText
  )

  $doc = New-Object System.Xml.XmlDocument
  $doc.LoadXml($XmlText)
  return $doc
}

function Get-DocxText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $documentXml = Get-ZipEntryText -Zip $zip -EntryPath "word/document.xml"
    if (-not $documentXml) {
      throw "word/document.xml not found in $Path"
    }

    $newline = [Environment]::NewLine
    $text = $documentXml `
      -replace "<w:tab[^>]*/>", " " `
      -replace "</w:p>", $newline `
      -replace "</w:tr>", $newline `
      -replace "<[^>]+>", " "

    $text = [System.Net.WebUtility]::HtmlDecode($text)
    return ($text -replace "[ \t]+", " " -replace "(\r?\n\s*){2,}", ($newline + $newline)).Trim()
  } finally {
    $zip.Dispose()
  }
}

function Get-CellText {
  param(
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlNode]$Cell,

    [string[]]$SharedStrings
  )

  $type = $null
  if ($Cell.Attributes["t"]) {
    $type = $Cell.Attributes["t"].Value
  }

  if ($type -eq "inlineStr") {
    $inlineParts = @($Cell.SelectNodes(".//*[local-name()='t']"))
    return (($inlineParts | ForEach-Object { $_.InnerText }) -join "").Trim()
  }

  $valueNode = $Cell.SelectSingleNode("./*[local-name()='v']")
  if (-not $valueNode) {
    return ""
  }

  $value = $valueNode.InnerText

  if ($type -eq "s" -and $value -match "^\d+$") {
    return $SharedStrings[[int]$value]
  }

  if ($type -eq "b") {
    return $(if ($value -eq "1") { "TRUE" } else { "FALSE" })
  }

  return $value.Trim()
}

function Get-XlsxText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $workbookXml = Get-ZipEntryText -Zip $zip -EntryPath "xl/workbook.xml"
    $relsXml = Get-ZipEntryText -Zip $zip -EntryPath "xl/_rels/workbook.xml.rels"

    if (-not $workbookXml -or -not $relsXml) {
      throw "Workbook metadata missing in $Path"
    }

    $workbookDoc = Get-XmlDocument -XmlText $workbookXml
    $relsDoc = Get-XmlDocument -XmlText $relsXml

    $sharedStrings = @()
    $sharedStringsXml = Get-ZipEntryText -Zip $zip -EntryPath "xl/sharedStrings.xml"
    if ($sharedStringsXml) {
      $sharedDoc = Get-XmlDocument -XmlText $sharedStringsXml
      foreach ($si in $sharedDoc.SelectNodes("//*[local-name()='si']")) {
        $parts = @($si.SelectNodes(".//*[local-name()='t']"))
        $sharedStrings += (($parts | ForEach-Object { $_.InnerText }) -join "")
      }
    }

    $sheetTargets = @{}
    foreach ($relationship in $relsDoc.SelectNodes("//*[local-name()='Relationship']")) {
      $sheetTargets[$relationship.Id] = $relationship.Target
    }

    $sections = New-Object System.Collections.Generic.List[string]

    foreach ($sheet in $workbookDoc.SelectNodes("//*[local-name()='sheet']")) {
      $sheetName = $sheet.Attributes["name"].Value
      $relationshipId = $sheet.Attributes["r:id"].Value
      $target = $sheetTargets[$relationshipId]
      if (-not $target) {
        continue
      }

      $sheetXml = Get-ZipEntryText -Zip $zip -EntryPath ("xl/" + $target)
      if (-not $sheetXml) {
        continue
      }

      $sheetDoc = Get-XmlDocument -XmlText $sheetXml
      $rows = New-Object System.Collections.Generic.List[string]

      foreach ($row in $sheetDoc.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']")) {
        $cells = @()
        foreach ($cell in $row.SelectNodes("./*[local-name()='c']")) {
          $cellText = Get-CellText -Cell $cell -SharedStrings $sharedStrings
          $cells += $cellText
        }

        $line = (($cells | Where-Object { $_ -ne $null }) -join " | ").Trim()
        if ($line) {
          $rows.Add($line)
        }
      }

      if ($rows.Count -gt 0) {
        $sections.Add("Sheet: $sheetName")
        $sections.Add(($rows -join [Environment]::NewLine))
      }
    }

    return ($sections -join ([Environment]::NewLine + [Environment]::NewLine)).Trim()
  } finally {
    $zip.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

foreach ($sourceFile in $SourceFiles) {
  if (-not (Test-Path -LiteralPath $sourceFile)) {
    throw "Source file not found: $sourceFile"
  }

  $resolvedSource = (Resolve-Path -LiteralPath $sourceFile).Path
  $extension = [System.IO.Path]::GetExtension($resolvedSource).ToLowerInvariant()
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedSource)
  $outputPath = Join-Path $OutputDir ($baseName + ".txt")

  switch ($extension) {
    ".docx" {
      $text = Get-DocxText -Path $resolvedSource
    }
    ".xlsx" {
      $text = Get-XlsxText -Path $resolvedSource
    }
    default {
      throw "Unsupported source type: $resolvedSource"
    }
  }

  Set-Content -LiteralPath $outputPath -Value $text -Encoding UTF8
  Write-Host "Imported $resolvedSource -> $outputPath"
}
