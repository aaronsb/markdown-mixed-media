# Maintainer: Aaron Bockelie <aaronsb@gmail.com>
pkgname=mmm
pkgver=1.1.1
pkgrel=1
pkgdesc="Markdown Mixed Media - A powerful terminal markdown viewer with image support, Mermaid diagrams, and PDF/ODT export"
arch=('any')
url="https://github.com/aaronsb/markdown-mixed-media"
license=('MIT')
depends=('nodejs>=22')
optdepends=(
    'chafa: Terminal image rendering support'
    'mermaid-cli: Mermaid diagram rendering'
    'chromium: PDF generation support'
)
makedepends=('npm' 'git')
options=('!strip')  # Don't strip binaries to avoid fakeroot issues
source=("$pkgname-$pkgver.tar.gz::https://github.com/aaronsb/markdown-mixed-media/archive/v$pkgver.tar.gz")
sha256sums=('cb68b908a65e609d956ac71c068b8c291bbd5fd8eb42862051260b2d3ad8eb0c')

build() {
    cd "$srcdir/markdown-mixed-media-$pkgver"

    # puppeteer is an optionalDependency (runtime-detected). Skip its bundled
    # Chromium download — users install system chromium (see optdepends).
    # This also makes the build work on architectures where puppeteer has no
    # prebuilt Chrome binary (e.g. aarch64).
    export PUPPETEER_SKIP_DOWNLOAD=true

    # Install dependencies (.npmrc sets legacy-peer-deps for marked-emoji compat)
    npm install --production=false

    # Build the project
    npm run build

    # Create the executable
    npm run build:simple
}

package() {
    cd "$srcdir/markdown-mixed-media-$pkgver"

    # Create directories
    install -dm755 "$pkgdir/usr/lib/$pkgname"
    install -dm755 "$pkgdir/usr/bin"

    # Copy built files
    cp -r dist "$pkgdir/usr/lib/$pkgname/"
    cp package.json "$pkgdir/usr/lib/$pkgname/"

    # Copy node_modules but exclude problematic binaries
    cp -r node_modules "$pkgdir/usr/lib/$pkgname/"

    # Strip native code out of node_modules. This package is arch=('any'), so
    # anything ELF in it is both wrong and unusable — a prebuild for one
    # platform shipped to every platform.
    #
    # *.bare is here because the list without it was incomplete rather than
    # wrong: bare-url arrives transitively and ships prebuilds/{android-x64,
    # linux-arm64,linux-x64}/*.bare, which namcap reports as ELF files in an
    # 'any' package. The three patterns below were already catching the same
    # class of file under different extensions.
    _nm="$pkgdir/usr/lib/$pkgname/node_modules"
    find "$_nm" -type f \( -name "*.node" -o -name "*.so" -o -name "*.dylib" \
                            -o -name "*.bare" \) -delete 2>/dev/null || true

    # Dependencies ship their own build tooling. katex carries src/metrics and
    # src/fonts, Python scripts it uses to regenerate font metrics during its
    # own development. Nothing here runs them, but namcap reads their imports
    # and concludes the package depends on python.
    find "$_nm" -type f -name "*.py" -delete 2>/dev/null || true

    # Create wrapper script
    cat > "$pkgdir/usr/bin/$pkgname" << EOF
#!/usr/bin/env node
import '/usr/lib/$pkgname/dist/index-direct.js';
EOF

    # Make executable
    chmod 755 "$pkgdir/usr/bin/$pkgname"

    # Install license
    install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"

    # Install documentation
    install -Dm644 README.md "$pkgdir/usr/share/doc/$pkgname/README.md"
}