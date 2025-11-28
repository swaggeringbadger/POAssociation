{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.nodePackages.typescript-language-server
    pkgs.yarn
    pkgs.replitPackages.jest

    # Chromium dependencies for Playwright
    pkgs.chromium
    pkgs.glib
    pkgs.gtk3
    pkgs.atk
    pkgs.at-spi2-atk
    pkgs.cairo
    pkgs.pango
    pkgs.gdk-pixbuf
    pkgs.xorg.libX11
    pkgs.xorg.libXcomposite
    pkgs.xorg.libXdamage
    pkgs.xorg.libXext
    pkgs.xorg.libXfixes
    pkgs.xorg.libXrandr
    pkgs.xorg.libxcb
    pkgs.nspr
    pkgs.nss
    pkgs.cups
    pkgs.dbus
    pkgs.expat
    pkgs.libdrm
    pkgs.mesa
    pkgs.alsa-lib
  ];
}
