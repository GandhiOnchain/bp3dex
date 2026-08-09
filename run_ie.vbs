Set ie = CreateObject("InternetExplorer.Application")
ie.Visible = False
ie.Navigate "file:///d:/basepaint/test_syntax.html"
WScript.Sleep 2000
ie.Quit