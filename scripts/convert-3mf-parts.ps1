param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDirectory,
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\public\models\robot-arm')
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SourceDirectory).Path
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$output = (Resolve-Path -LiteralPath $OutputDirectory).Path

$parts = @(
  @{ Source = 'Base Bottom_1.model'; Output = 'base-bottom.stl' },
  @{ Source = 'Body9_5.model'; Output = 'base-body.stl' },
  @{ Source = 'Stepper Hat_1.model'; Output = 'stepper-hat.stl' },
  @{ Source = 'Joint 1 v5_6.model'; Output = 'joint-1.stl' },
  @{ Source = 'Joint 2 v5_7.model'; Output = 'joint-2.stl' },
  @{ Source = 'Gripper v5_4.model'; Output = 'gripper.stl' },
  @{ Source = 'Claw v5_3.model'; Output = 'claw.stl' },
  @{ Source = 'Claw Insert_2.model'; Output = 'claw-insert.stl' }
)

function Write-Float([System.IO.BinaryWriter]$Writer, [double]$Value) {
  $Writer.Write([single]$Value)
}

function Convert-ModelToBinaryStl([string]$InputPath, [string]$OutputPath) {
  [xml]$document = Get-Content -Raw -LiteralPath $InputPath
  $namespace = New-Object System.Xml.XmlNamespaceManager($document.NameTable)
  $namespace.AddNamespace('m', 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02')
  $vertexNodes = $document.SelectNodes('//m:mesh/m:vertices/m:vertex', $namespace)
  $triangleNodes = $document.SelectNodes('//m:mesh/m:triangles/m:triangle', $namespace)
  if ($vertexNodes.Count -eq 0 -or $triangleNodes.Count -eq 0) {
    throw "No mesh found in $InputPath"
  }

  $vertices = [System.Collections.Generic.List[double[]]]::new()
  foreach ($vertex in $vertexNodes) {
    $vertices.Add(@([double]$vertex.x, [double]$vertex.y, [double]$vertex.z))
  }

  $stream = [System.IO.File]::Create($OutputPath)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $header = New-Object byte[] 80
    $label = [Text.Encoding]::ASCII.GetBytes('ARM-01 3MF mesh')
    [Array]::Copy($label, $header, $label.Length)
    $writer.Write($header)
    $writer.Write([uint32]$triangleNodes.Count)

    foreach ($triangle in $triangleNodes) {
      $a = $vertices[[int]$triangle.v1]
      $b = $vertices[[int]$triangle.v2]
      $c = $vertices[[int]$triangle.v3]
      $ux = $b[0] - $a[0]; $uy = $b[1] - $a[1]; $uz = $b[2] - $a[2]
      $vx = $c[0] - $a[0]; $vy = $c[1] - $a[1]; $vz = $c[2] - $a[2]
      $nx = $uy * $vz - $uz * $vy
      $ny = $uz * $vx - $ux * $vz
      $nz = $ux * $vy - $uy * $vx
      $length = [Math]::Sqrt($nx * $nx + $ny * $ny + $nz * $nz)
      if ($length -gt 0) { $nx /= $length; $ny /= $length; $nz /= $length }
      Write-Float $writer $nx; Write-Float $writer $ny; Write-Float $writer $nz
      foreach ($point in @($a, $b, $c)) {
        Write-Float $writer $point[0]; Write-Float $writer $point[1]; Write-Float $writer $point[2]
      }
      $writer.Write([uint16]0)
    }
  } finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

foreach ($part in $parts) {
  $inputPath = Join-Path $source $part.Source
  $outputPath = Join-Path $output $part.Output
  Convert-ModelToBinaryStl $inputPath $outputPath
  Write-Output $outputPath
}
