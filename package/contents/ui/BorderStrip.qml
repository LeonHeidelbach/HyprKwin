// One edge of a focus border. Borders are four strips that only cover the gap
// around a window and never its contents; a strip lets every click and hover
// through (outputOnly), so the holes it leaves for what is in front of the
// window (a menu, a tooltip) can be used too.
import QtQuick
import QtQuick.Shapes
import QtQuick.Window
import "../code/cuts.js" as Cuts

Window {
    id: strip

    property rect area: Qt.rect(0, 0, 0, 0)
    // What is in front of the window the border belongs to (menus, tooltips,
    // windows stacked above, panels): left out, as holes the strip does not
    // paint, so they show through. It stays mapped whatever is covered.
    property var cuts: []
    readonly property bool holed: Cuts.crosses(area, cuts)
    readonly property var pieces: holed ? Cuts.visiblePieces(area, cuts) : []
    // KWin's own on-screen displays are made the same way: input goes
    // straight through to whatever is underneath.
    property bool outputOnly: true
    // Every strip draws the whole ring, positioned so that only its own piece
    // of it falls inside the window. That keeps corners exact and lets one
    // gradient run around the entire border.
    property size ring: Qt.size(0, 0)       // the border's outer size
    property point offset: Qt.point(0, 0)   // where this strip sits in it
    property int radius: 0
    property int thickness: 2
    property color stripColor: "#33ccff"
    property color stripColor2: stripColor  // the far end of the gradient
    property real angle: 45                 // 0 = left to right, 90 = top to bottom
    property bool shown: false
    property bool overlaysHidden: false
    property int revision: 0
    onOverlaysHiddenChanged: sync()
    onRevisionChanged: sync()

    title: "HyprKwin overlay"
    color: "transparent"
    flags: Qt.X11BypassWindowManagerHint | Qt.FramelessWindowHint | Qt.WindowDoesNotAcceptFocus | Qt.WindowTransparentForInput
    // The window takes its place in one go (see place()), not by binding x,
    // y, width and height, each of which would move it on its own: four
    // geometry changes for every strip each time a border moves.

    // Never show a window with a zero, negative or NaN size: KWin cannot make
    // a framebuffer for it, and the window is then stuck at a fallback size.
    function usable(v) {
        return typeof v === "number" && isFinite(v) && v >= 1;
    }
    readonly property bool ready: usable(area.width) && usable(area.height) && isFinite(area.x) && isFinite(area.y)

    function place() {
        const gx = isFinite(area.x) ? Math.round(area.x) : 0, gy = isFinite(area.y) ? Math.round(area.y) : 0;
        const gw = usable(area.width) ? Math.round(area.width) : 1, gh = usable(area.height) ? Math.round(area.height) : 1;
        if (x !== gx || y !== gy || width !== gw || height !== gh) setGeometry(gx, gy, gw, gh);
    }

    // Only when that changes: showing a window already shown is not free,
    // and this runs for every strip each time the borders are redrawn.
    function sync() {
        const want = shown && !overlaysHidden && ready;
        if (want && !visible) {
            place();                    // never shown at a size it does not have yet
            show();
        }
        else if (!want && visible) hide();
    }
    onReadyChanged: sync()
    onShownChanged: sync()
    onAreaChanged: {
        place();
        sync();
    }
    Component.onCompleted: {
        place();
        sync();
    }
    // KWin keeps shown internal windows alive when the script's QML engine
    // goes away, so make sure they disappear with us.
    Component.onDestruction: hide()

    // Square corners in one colour, the usual case: the strip is simply
    // filled. Drawing the ring as a shape costs a fresh tessellation every
    // time the window it surrounds changes size, for every strip, which a
    // drag does at every step.
    readonly property bool plain: radius <= 0 && Qt.colorEqual(stripColor, stripColor2)

    // Nothing in front of it, the usual case: one rectangle, or one ring.
    Rectangle {
        anchors.fill: parent
        visible: strip.plain && !strip.holed
        color: strip.stripColor
    }
    Loader {
        active: !strip.plain && !strip.holed
        sourceComponent: ringComponent
    }

    // Something in front: only the uncovered pieces are painted. The pieces
    // are counted, not handed over as a list, so they stay as they are
    // while only their sizes change.
    Repeater {
        model: strip.holed ? strip.pieces.length : 0
        Item {
            required property int index
            readonly property var piece: strip.pieces[index] || { x: 0, y: 0, width: 0, height: 0 }
            x: piece.x
            y: piece.y
            width: piece.width
            height: piece.height
            clip: true
            Rectangle {
                anchors.fill: parent
                visible: strip.plain
                color: strip.stripColor
            }
            Loader {
                x: -parent.x
                y: -parent.y
                active: !strip.plain
                sourceComponent: ringComponent
            }
        }
    }

    Component {
        id: ringComponent
        Shape {
            id: ringShape
            x: -strip.offset.x
            y: -strip.offset.y
            width: strip.ring.width
            height: strip.ring.height
            preferredRendererType: Shape.CurveRenderer

            // The gradient line crosses the whole ring at the given angle, so its
            // two colours land on opposite corners, as Hyprland draws it.
            readonly property real rad: strip.angle * Math.PI / 180
            readonly property real reach: Math.abs(width / 2 * Math.cos(rad)) + Math.abs(height / 2 * Math.sin(rad))

            ShapePath {
                strokeColor: "transparent"
                strokeWidth: -1
                fillRule: ShapePath.OddEvenFill
                fillGradient: LinearGradient {
                    x1: strip.ring.width / 2 - Math.cos(ringShape.rad) * ringShape.reach
                    y1: strip.ring.height / 2 - Math.sin(ringShape.rad) * ringShape.reach
                    x2: strip.ring.width / 2 + Math.cos(ringShape.rad) * ringShape.reach
                    y2: strip.ring.height / 2 + Math.sin(ringShape.rad) * ringShape.reach
                    GradientStop { position: 0; color: strip.stripColor }
                    GradientStop { position: 1; color: strip.stripColor2 }
                }
                PathRectangle {
                    x: 0; y: 0
                    width: strip.ring.width; height: strip.ring.height
                    radius: strip.radius
                }
                PathRectangle {
                    x: strip.thickness; y: strip.thickness
                    width: Math.max(0, strip.ring.width - 2 * strip.thickness)
                    height: Math.max(0, strip.ring.height - 2 * strip.thickness)
                    radius: Math.max(0, strip.radius - strip.thickness)
                }
            }
        }
    }
}
