var BedBreaker = new Module("BedBreaker", "Breaks beds around you", true, Constants.ModuleCategory.World);

var radiusSetting = new SliderSetting("Radius", 1, 8, 4, 0.5);
var swingSetting = new SwitchSetting("Swing", true);
var throughBlocksSetting = new SwitchSetting("Through Blocks", false);
var espSetting = new SwitchSetting("ESP", true);
var fastBreakSetting = new SwitchSetting("Fast Break", true);
var breakSpeedSetting = new SliderSetting("Break Speed", 1, 255, 180, 1);

BedBreaker.addSetting(radiusSetting);
BedBreaker.addSetting(swingSetting);
BedBreaker.addSetting(throughBlocksSetting);
BedBreaker.addSetting(espSetting);
BedBreaker.addSetting(fastBreakSetting);
BedBreaker.addSetting(breakSpeedSetting);

ModuleManager.addModule(BedBreaker);

var BED_ID = 26;

var currentTarget = null;
var currentPath = [];
var breakProgress = 0.0;
var scanCooldown = 0;
var cachedBeds = [];

function isBed(block) {
    if (!block) return false;
    try {
        if (block.getId() === BED_ID) return true;
    } catch (e) {}
    try {
        var sid = block.getStringId();
        if (sid && sid.toLowerCase().indexOf("bed") !== -1) return true;
    } catch (e) {}
    return false;
}

function isAir(block) {
    if (!block) return true;
    try {
        return block.getId() === 0;
    } catch (e) {
        return true;
    }
}

function scanBeds(radius) {
    var beds = [];
    var pp = LocalPlayer.getPos();
    var r = Math.ceil(radius);
    var px = Math.floor(pp[0]);
    var py = Math.floor(pp[1]);
    var pz = Math.floor(pp[2]);
    for (var x = px - r; x <= px + r; x++) {
        for (var y = py - r; y <= py + r; y++) {
            for (var z = pz - r; z <= pz + r; z++) {
                var dx = x - pp[0];
                var dy = y - pp[1];
                var dz = z - pp[2];
                if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
                var b = Level.getBlock([x, y, z]);
                if (isBed(b)) beds.push([x, y, z]);
            }
        }
    }
    return beds;
}

function buildPath(bedPos, playerPos) {
    var path = [];
    var topY = Math.floor(playerPos[1]);
    if (topY <= bedPos[1]) return path;
    for (var y = topY; y > bedPos[1]; y--) {
        var b = Level.getBlock([bedPos[0], y, bedPos[2]]);
        if (!isAir(b)) path.push([bedPos[0], y, bedPos[2]]);
    }
    return path;
}

function faceBlock(pos) {
    var pp = LocalPlayer.getPos();
    var eh = LocalPlayer.getEyeHeight();
    var dx = (pos[0] + 0.5) - pp[0];
    var dy = (pos[1] + 0.5) - (pp[1] + eh);
    var dz = (pos[2] + 0.5) - pp[2];
    var dist = Math.sqrt(dx * dx + dz * dz);
    LocalPlayer.setYaw(Math.atan2(-dx, dz) * 180 / Math.PI);
    LocalPlayer.setPitch(-Math.atan2(dy, dist) * 180 / Math.PI);
}

function doSwing() {
    if (swingSetting.getValue()) LocalPlayer.click(false);
}

function getIncrement(block) {
    var speed = fastBreakSetting.getValue() ? breakSpeedSetting.getValue() : 1;
    var dt = block.getDestroyTime();
    if (dt <= 0) return 1.0;
    return speed / (dt * 20.0);
}

Hooks.onTick = function () {
    if (!BedBreaker.isEnabled()) {
        currentTarget = null;
        currentPath = [];
        breakProgress = 0.0;
        cachedBeds = [];
        return;
    }

    var pp = LocalPlayer.getPos();
    var radius = radiusSetting.getValue();

    if (--scanCooldown <= 0) {
        cachedBeds = scanBeds(radius);
        scanCooldown = 3;
    }

    if (cachedBeds.length === 0) {
        currentTarget = null;
        currentPath = [];
        breakProgress = 0.0;
        return;
    }

    var best = null, bestDist = Infinity;
    for (var i = 0; i < cachedBeds.length; i++) {
        var b = cachedBeds[i];
        var dx = b[0] - pp[0], dy = b[1] - pp[1], dz = b[2] - pp[2];
        var d = dx * dx + dy * dy + dz * dz;
        if (d < bestDist) { bestDist = d; best = b; }
    }

    if (!currentTarget || currentTarget[0] !== best[0] || currentTarget[1] !== best[1] || currentTarget[2] !== best[2]) {
        currentTarget = best;
        breakProgress = 0.0;
    }

    currentPath = throughBlocksSetting.getValue() ? [] : buildPath(currentTarget, pp);

    var active = currentPath.length > 0 ? currentPath[0] : currentTarget;
    faceBlock(active);
    doSwing();

    var block = Level.getBlock(active);
    if (!block) return;

    breakProgress += getIncrement(block);

    if (breakProgress >= 1.0) {
        LocalPlayer.breakBlock(active, 1);
        breakProgress = 0.0;
        if (currentPath.length > 0) currentPath.shift();
        else currentTarget = null;
    }
};

Hooks.onRender3D = function () {
    if (!BedBreaker.isEnabled() || !espSetting.getValue()) return;

    for (var i = 0; i < cachedBeds.length; i++) {
        var b = cachedBeds[i];
        var isTarget = currentTarget && currentTarget[0] === b[0] && currentTarget[1] === b[1] && currentTarget[2] === b[2];
        var color = isTarget ? [breakProgress, 1.0 - breakProgress, 0.0, 0.9] : [0.0, 1.0, 0.0, 0.5];
        Renderer.drawOutlineBox3D([b[0], b[1], b[2]], [b[0] + 1, b[1] + 1, b[2] + 1], color);
    }

    for (var j = 0; j < currentPath.length; j++) {
        var p = currentPath[j];
        Renderer.drawOutlineBox3D([p[0], p[1], p[2]], [p[0] + 1, p[1] + 1, p[2] + 1], [1.0, 0.4, 0.0, 0.7]);
    }
};

Hooks.onPostRender = function () {
    if (!BedBreaker.isEnabled() || !currentTarget) return;

    var sw = Game.getScreenWidth();
    var sh = Game.getScreenHeight();
    var pct = Math.floor(breakProgress * 100);
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;

    Renderer.drawText(
        "Breaking Bed: " + pct + "%",
        [sw / 2, sh / 2 + 40],
        [breakProgress, 1.0 - breakProgress, 0.0, 1.0],
        0,
        1
    );
};
