$port = 8080
$path = "d:\basepaint"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Server started! Open http://localhost:$port/ in your browser."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $localPath = $request.Url.LocalPath.TrimStart('/')
        if ($localPath -eq "") { $localPath = "index.html" }
        $fullPath = Join-Path $path $localPath

        if (Test-Path $fullPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $mime = "application/octet-stream"
            switch ($ext) {
                ".html" { $mime = "text/html" }
                ".js"   { $mime = "application/javascript" }
                ".css"  { $mime = "text/css" }
                ".png"  { $mime = "image/png" }
                ".json" { $mime = "application/json" }
            }
            $response.ContentType = $mime
            
            $content = [System.IO.File]::ReadAllBytes($fullPath)
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
