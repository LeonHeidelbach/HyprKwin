// Where a preselected window will go, as bspwm's presel_feedback shows it:
// a filled area over the part of the tile it will take.
import QtQuick
import QtQuick.Window
import "../code/cuts.js" as Cuts

Window {
    id: win

    property var area: null              // {x, y, width, height}
    // What is in front of it (a menu, a tooltip, a window above): left out,
    // as holes it does not paint.
    property var cuts: []
    readonly property bool holed: !!area && Cuts.crosses(area, cuts)
    readonly property var pieces: holed ? Cuts.visiblePieces(area, cuts) : []
    property bool outputOnly: true         // clicks go through to the window
    property color fillColor: "#27293b"
    property real fillOpacity: 0.8
    property int radius: 0
    property bool overlaysHidden: false
    property int revision: 0
    onRevisionChanged: sync()

    title: "HyprKwin overlay"
    color: "transparent"
    flags: Qt.X11BypassWindowManagerHint | Qt.FramelessWindowHint | Qt.WindowDoesNotAcceptFocus | Qt.WindowTransparentForInput

    function usable(v) {
        return typeof v === "number" && isFinite(v) && v >= 1;
    }
    readonly property bool ready: !!area && usable(area.width) && usable(area.height) && isFinite(area.x) && isFinite(area.y)

    // In one go (as a border strip does), not by x, y, width and height each.
    function place() {
        if (!ready) return;
        const r = [Math.round(area.x), Math.round(area.y), Math.round(area.width), Math.round(area.height)];
        if (x !== r[0] || y !== r[1] || width !== r[2] || height !== r[3]) setGeometry(r[0], r[1], r[2], r[3]);
    }

    // Same interface as the other overlays.
    function hideAll() {
        hide();
    }

    function sync() {
        const want = ready && !overlaysHidden;
        if (want && !visible) {
            place();                    // never shown at a size it does not have yet
            show();
        }
        else if (!want && visible) hide();
    }
    onReadyChanged: sync()
    onAreaChanged: {
        place();
        sync();
    }
    onOverlaysHiddenChanged: sync()
    Component.onCompleted: {
        place();
        sync();
    }
    Component.onDestruction: hide()

    readonly property int corner: Math.max(0, Math.min(radius, Math.floor(Math.min(width, height) / 2)))

    Rectangle {
        anchors.fill: parent
        visible: !win.holed
        color: win.fillColor
        opacity: win.fillOpacity
        radius: win.corner
    }

    Repeater {
        model: win.holed ? win.pieces.length : 0
        Item {
            required property int index
            readonly property var piece: win.pieces[index] || { x: 0, y: 0, width: 0, height: 0 }
            x: piece.x
            y: piece.y
            width: piece.width
            height: piece.height
            clip: true
            Rectangle {
                x: -parent.x
                y: -parent.y
                width: win.width
                height: win.height
                color: win.fillColor
                opacity: win.fillOpacity
                radius: win.corner
            }
        }
    }
}
