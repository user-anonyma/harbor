!macro NSIS_HOOK_PREINSTALL
  ; Harbor: force-close everything that could hold a bundled .exe open during an
  ; update, so files like mpv.exe / stremio-server.exe are never locked (this was
  ; the "Error opening file for writing: ...\mpv.exe" install failure).
  ; /T kills child processes too. Errors are ignored (process may not be running).

  ; The player sidecar — this is the one that locked mpv.exe when a video was open.
  nsExec::Exec 'taskkill /F /T /FI "IMAGENAME eq mpv*"'
  Pop $0
  nsExec::Exec 'taskkill /F /T /IM mpv.exe'
  Pop $0

  ; The stremio-server sidecar (matches the triple-suffixed name too).
  nsExec::Exec 'taskkill /F /T /FI "IMAGENAME eq stremio-server*"'
  Pop $0
  nsExec::Exec 'taskkill /F /T /IM stremio-server.exe'
  Pop $0

  ; The main app itself, in case the auto-updater hasn't already closed it.
  nsExec::Exec 'taskkill /F /T /IM Harbor.exe'
  Pop $0

  Sleep 1000
!macroend
