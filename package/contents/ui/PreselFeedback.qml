// Where a preselected window will go, as bspwm's presel_feedback shows it:
// a filled area over the part of the tile it will take.
import QtQuick
import QtQuick.Window

Window {
    id: win

    property var area: null              // {x, y, width, height}
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

    x: ready ? area.x : 0
    y: ready ? area.y : 0
    width: ready ? area.width : 1
    height: ready ? area.height : 1

    // Same interface as the other overlays.
    function hideAll() {
        hide();
    }

    function sync() {
        if (ready && !overlaysHidden) show();
        else hide();
    }
    onReadyChanged: sync()
    onAreaChanged: sync()
    onOverlaysHiddenChanged: sync()
    Component.onCompleted: sync()
    Component.onDestruction: hide()

    Rectangle {
        anchors.fill: parent
        color: win.fillColor
        opacity: win.fillOpacity
        radius: Math.max(0, Math.min(win.radius, Math.floor(Math.min(win.width, win.height) / 2)))
    }
}
