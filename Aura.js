var module_Killaura = new Module("Aura", "KillAura", true, 0);

var mode_KA = new ModeSetting("Mode", ["Single", "Switch"]);
var radius_KA = new SliderSetting("Radius", [4.5, 1, 10, 0.1]);
var randomCps = new StateSetting("Random CPS", false);
var speedAtackBread_KA = new SliderSetting("CPS", [6, 1, 30, 1]);
var minCps = new SliderSetting("Min CPS", [8, 1, 30, 1]);
var maxCps = new SliderSetting("Max CPS", [12, 1, 30, 1]);
var switchDelay = new SliderSetting("SwitchDelay", [1, 1, 20, 1]);

var hb_KA = new StateSetting("BreadixBypass", true);
var autoSword = new StateSetting("AutoSword", true);
var autoBlock = new StateSetting("AutoBlock", true);
var autoEquip = new StateSetting("AutoEquip", true);
var strafe = new StateSetting("Strafe", false);
var scaf = new StateSetting("disable in scaffold", true);
var closeatt = new StateSetting("CloseInv", false);
var noswing = new StateSetting("NoSwing", false);

var predetect = new StateSetting("PreDetect", false);
var prejump = new StateSetting("PreJump", false);
var presprint = new StateSetting("PreSprintOff", false);
var precrit = new StateSetting("OnlyCrit", false);
var detectRadius = new SliderSetting("DetectRadius", [3.0, 1.0, 8.0, 0.5]);

var rotationMode = new ModeSetting("Rotation", ["Vanilla", "Flick", "Spooky", "None"]);
var rotSpeed = new SliderSetting("Speed", [300, 20, 1000, 5]);
var radiusRot = new SliderSetting("RadiusRot", [6.0, 1, 12, 0.1]);
var spookyFov = new SliderSetting("Spooky Fov", [40, 10, 90, 1]);
var spookySpeed = new SliderSetting("Spooky Speed", [6, 1, 20, 1]);

var fovSetting = new StateSetting("FovCheck", true);
var fovXZ = new SliderSetting("FovXZ", [300, 10, 360, 1]);
var fovY = new SliderSetting("FovY", [180, 10, 180, 1]);

var otherSectionVisible = false;
var preSectionVisible = false;
var fovSectionVisible = false;
var rotSectionVisible = false;

var buttother = new ButtonSetting("Other", function() {
    otherSectionVisible = !otherSectionVisible;
    hb_KA.setVisibility(otherSectionVisible);
    autoSword.setVisibility(otherSectionVisible);
    autoBlock.setVisibility(otherSectionVisible);
    autoEquip.setVisibility(otherSectionVisible);
    strafe.setVisibility(otherSectionVisible);
    scaf.setVisibility(otherSectionVisible);
    closeatt.setVisibility(otherSectionVisible);
    noswing.setVisibility(otherSectionVisible);
});

var buttpre = new ButtonSetting("PreDetectPlayer", function() {
    preSectionVisible = !preSectionVisible;
    predetect.setVisibility(preSectionVisible);
    presprint.setVisibility(preSectionVisible);
    precrit.setVisibility(preSectionVisible);
    prejump.setVisibility(preSectionVisible);
    detectRadius.setVisibility(preSectionVisible);
});

var buttfov = new ButtonSetting("Fov", function() {
    fovSectionVisible = !fovSectionVisible;
    fovSetting.setVisibility(fovSectionVisible);
    fovXZ.setVisibility(fovSectionVisible);
    fovY.setVisibility(fovSectionVisible);
});

var buttrot = new ButtonSetting("Rotation", function() {
    rotSectionVisible = !rotSectionVisible;
    rotationMode.setVisibility(rotSectionVisible);
    rotSpeed.setVisibility(rotSectionVisible);
    radiusRot.setVisibility(rotSectionVisible);
    updateSpookyVisibility();
});

function updateCpsVisibility() {
    var r = randomCps.isActive();
    speedAtackBread_KA.setVisibility(!r);
    minCps.setVisibility(r);
    maxCps.setVisibility(r);
}

function updateSpookyVisibility() {
    var show = rotSectionVisible && rotationMode.getCurrentMode() === "Spooky";
    spookyFov.setVisibility(show);
    spookySpeed.setVisibility(show);
}

randomCps.setOnStateToggleListener(function() {
    updateCpsVisibility();
    auraNextAttackDelay = 0;
});

rotationMode.setOnModeSelectedListener(function() {
    updateSpookyVisibility();
});

function addAllSettings(mod, arr) {
    if (typeof mod.addSettings === "function") mod.addSettings(arr);
    else for (var i = 0; i < arr.length; i++) mod.addSetting(arr[i]);
}

addAllSettings(module_Killaura, [
    mode_KA, radius_KA, randomCps, speedAtackBread_KA, minCps, maxCps, switchDelay,
    buttother, hb_KA, autoSword, autoBlock, autoEquip, strafe, scaf, closeatt, noswing,
    buttpre, predetect, presprint, precrit, prejump, detectRadius,
    buttfov, fovSetting, fovXZ, fovY,
    buttrot, rotationMode, rotSpeed, radiusRot, spookyFov, spookySpeed
]);

var fixedTarget = -1;
var fixedTargetEntity = null;
var rotTarget = -1;
var rotTargetEntity = null;
var switchTargets = [];
var switchIndex = 0;
var lastAttackTime = 0;
var auraNextAttackDelay = 0;
var spookyPhase = 0;
var switchCooldown = 0;
var swordSlotCache = -1;
var swordSlotCacheTime = 0;

function isSwordId(id) {
    return id === 276 || id === 267 || id === 272 || id === 268 || id === 283;
}

function findSwordSlot() {
    var now = Date.now();
    if (now - swordSlotCacheTime < 500 && swordSlotCache !== -1) return swordSlotCache;
    swordSlotCacheTime = now;
    for (var i = 0; i < 9; i++) {
        try {
            var item = Inventory.getItem(i);
            if (item && isSwordId(item.getId())) {
                swordSlotCache = i;
                return i;
            }
        } catch (e) {}
    }
    swordSlotCache = -1;
    return -1;
}

function selectAutoSword() {
    if (!autoEquip.isActive() && !autoSword.isActive()) return;
    var slot = findSwordSlot();
    if (slot === -1) return;
    try {
        if (Inventory.getSelectedSlot() === slot) return;
    } catch (e) {}
    try { Inventory.selectSlot(slot); } catch (e2) {}
}

function wrapAngle(a) {
    while (a <= -180) a += 360;
    while (a > 180) a -= 360;
    return a;
}

function rotateSmooth(targetYaw, targetPitch, speedMs) {
    var step = Math.max(1, speedMs / 100);
    var curYaw = LocalPlayer.getYaw();
    var curPitch = LocalPlayer.getPitch();
    var dYaw = wrapAngle(targetYaw - curYaw);
    var dPitch = targetPitch - curPitch;
    if (Math.abs(dYaw) <= step) curYaw = targetYaw;
    else curYaw += (dYaw > 0 ? step : -step);
    if (Math.abs(dPitch) <= step) curPitch = targetPitch;
    else curPitch += (dPitch > 0 ? step : -step);
    LocalPlayer.setYaw(curYaw);
    LocalPlayer.setPitch(curPitch);
}

function rotateInstant(targetYaw, targetPitch) {
    LocalPlayer.setYaw(targetYaw);
    LocalPlayer.setPitch(targetPitch);
}

function computeRotToEntity(entity) {
    var pp = LocalPlayer.getPos();
    var ep = entity.getPos();
    var dx = ep[0] - pp[0];
    var dy = ep[1] - pp[1];
    var dz = ep[2] - pp[2];
    var distXZ = Math.sqrt(dx * dx + dz * dz);
    var yaw = Math.atan2(-dx, dz) * 180 / Math.PI;
    var pitch = Math.atan2(-dy, distXZ) * 180 / Math.PI;
    return [yaw, pitch];
}

function applyAuraRotation() {
    if (!module_Killaura.isActive()) return;
    if (!rotTargetEntity) return;
    var mode = rotationMode.getCurrentMode();
    if (mode === "None") return;
    var r = computeRotToEntity(rotTargetEntity);
    if (mode === "Vanilla") {
        rotateSmooth(r[0], r[1], rotSpeed.getCurrentValue());
    } else if (mode === "Flick") {
        rotateInstant(r[0], r[1]);
    } else if (mode === "Spooky") {
        spookyPhase += spookySpeed.getCurrentValue() * 0.06;
        if (spookyPhase > Math.PI * 2) spookyPhase -= Math.PI * 2;
        var off = Math.sin(spookyPhase) * (spookyFov.getCurrentValue() / 2);
        rotateSmooth(r[0] + off, r[1], rotSpeed.getCurrentValue());
    }
}

function shouldAuraAttack() {
    if (!fixedTargetEntity) return false;
    if (!precrit.isActive() || !predetect.isActive()) return true;
    if (predetect.isActive() && precrit.isActive() && LocalPlayer.isFalling()) return true;
    return false;
}

function doAutoBlock() {
    if (!autoBlock.isActive()) return;
    try { LocalPlayer.click(true); } catch (e) {}
}

function executeAuraAttack() {
    selectAutoSword();
    doAutoBlock();
    applyAuraRotation();
    try { LocalPlayer.attack(fixedTargetEntity); } catch (e) {}
}

function performAuraAttack() {
    if (!shouldAuraAttack()) return false;
    executeAuraAttack();
    return true;
}

function handlePostAttackActions() {
    if (mode_KA.getCurrentMode() !== "Switch") return;
    if (switchTargets.length === 0 || switchCooldown > 0) return;
    switchIndex++;
    if (switchIndex >= switchTargets.length) {
        switchIndex = 0;
        switchTargets = getValidPlayers();
    }
    if (switchTargets.length > 0) {
        fixedTargetEntity = switchTargets[switchIndex];
        fixedTarget = fixedTargetEntity.getId();
        switchCooldown = switchDelay.getCurrentValue();
    } else {
        fixedTarget = -1;
        fixedTargetEntity = null;
    }
}

var cachedPlayers = [];
var lastPlayersUpdate = 0;
var playersUpdateInterval = 125;

var auraTick = {
    lx: 0, ly: 0, lz: 0,
    localName: "",
    radius: 4.5, radiusSq: 20.25, radiusPlus1: 5.5,
    radiusRot: 6.0, radiusRotSq: 36.0,
    fovOn: true, fovXZ: 300, fovY: 180
};

function auraRefreshTick() {
    auraTick.lx = LocalPlayer.getPosX();
    auraTick.ly = LocalPlayer.getPosY();
    auraTick.lz = LocalPlayer.getPosZ();
    try {
        var n = LocalPlayer.getNameTag();
        auraTick.localName = n ? ("" + n).toLowerCase() : "";
    } catch (e) { auraTick.localName = ""; }
    auraTick.radius = radius_KA.getCurrentValue();
    auraTick.radiusSq = auraTick.radius * auraTick.radius;
    auraTick.radiusPlus1 = auraTick.radius + 1;
    auraTick.radiusRot = radiusRot.getCurrentValue();
    auraTick.radiusRotSq = auraTick.radiusRot * auraTick.radiusRot;
    auraTick.fovOn = fovSetting.isActive();
    if (auraTick.fovOn) {
        auraTick.fovXZ = fovXZ.getCurrentValue();
        auraTick.fovY = fovY.getCurrentValue();
    }
}

function entityInList(list, entity) {
    if (!entity) return false;
    var id = entity.getId();
    for (var i = 0; i < list.length; i++) {
        if (list[i].getId() === id) return true;
    }
    return false;
}

function getAuraCPS() {
    if (!randomCps.isActive()) return speedAtackBread_KA.getCurrentValue();
    var lo = minCps.getCurrentValue();
    var hi = maxCps.getCurrentValue();
    if (lo > hi) { var t = lo; lo = hi; hi = t; }
    return lo + Math.random() * (hi - lo);
}

function rollAuraAttackDelay() {
    auraNextAttackDelay = 1000 / Math.max(1, getAuraCPS());
}

function isInFOV(entity) {
    if (!auraTick.fovOn) return true;
    var ep = entity.getPos();
    var dx = ep[0] - auraTick.lx;
    var dy = ep[1] - auraTick.ly;
    var dz = ep[2] - auraTick.lz;
    var distXZSq = dx * dx + dz * dz;
    if (distXZSq < 0.0001 && dy * dy < 0.0001) return true;
    var playerYaw = wrapAngle(LocalPlayer.getYaw());
    var playerPitch = LocalPlayer.getPitch();
    var distXZ = Math.sqrt(distXZSq);
    var targetYaw = wrapAngle(Math.atan2(-dx, dz) * (180 / Math.PI));
    var targetPitch = Math.atan2(-dy, distXZ) * (180 / Math.PI);
    return Math.abs(wrapAngle(targetYaw - playerYaw)) <= auraTick.fovXZ / 2
        && Math.abs(targetPitch - playerPitch) <= auraTick.fovY / 2;
}

function isValidTargetEntity(entity) {
    if (!entity) return false;
    if (!entity.isAlive()) return false;
    var d = LocalPlayer.getDistanceTo(entity);
    if (d * d > auraTick.radiusSq) return false;
    if (auraTick.fovOn && !isInFOV(entity)) return false;
    var name = entity.getNameTag();
    if (!name) return false;
    if (auraTick.localName && ("" + name).toLowerCase().indexOf(auraTick.localName) !== -1) return false;
    return true;
}

function getValidPlayers() {
    var now = Date.now();
    if (now - lastPlayersUpdate < playersUpdateInterval) return cachedPlayers;
    lastPlayersUpdate = now;
    var players = Level.getPlayers();
    var result = [];
    for (var i = 0; i < players.length; i++) {
        var e = players[i];
        if (isValidTargetEntity(e)) result.push(e);
    }
    cachedPlayers = result;
    return result;
}

function isValidRotationTarget(entity) {
    if (!entity) return false;
    if (!entity.isAlive()) return false;
    var d = LocalPlayer.getDistanceTo(entity);
    if (d * d > auraTick.radiusRotSq) return false;
    if (auraTick.fovOn && !isInFOV(entity)) return false;
    var name = entity.getNameTag();
    if (!name) return false;
    if (auraTick.localName && ("" + name).toLowerCase().indexOf(auraTick.localName) !== -1) return false;
    return true;
}

function updateAuraRotationTarget() {
    if (rotationMode.getCurrentMode() === "None") {
        rotTarget = -1;
        rotTargetEntity = null;
        return;
    }
    if (fixedTargetEntity && isValidRotationTarget(fixedTargetEntity)) {
        rotTarget = fixedTargetEntity.getId();
        rotTargetEntity = fixedTargetEntity;
        return;
    }
    var players = Level.getPlayers();
    var nearest = null;
    var best = auraTick.radiusRotSq;
    for (var i = 0; i < players.length; i++) {
        var e = players[i];
        if (!isValidRotationTarget(e)) continue;
        var d = LocalPlayer.getDistanceTo(e);
        var dsq = d * d;
        if (dsq < best) { best = dsq; nearest = e; }
    }
    if (nearest) {
        rotTarget = nearest.getId();
        rotTargetEntity = nearest;
    } else {
        rotTarget = -1;
        rotTargetEntity = null;
    }
}

function getNearestEntityInRange(radius) {
    var players = Level.getPlayers();
    var best = null;
    var bestDistSq = radius * radius;
    for (var i = 0; i < players.length; i++) {
        var e = players[i];
        if (!e || !e.isAlive()) continue;
        var d = LocalPlayer.getDistanceTo(e);
        var dsq = d * d;
        if (dsq < bestDistSq) { bestDistSq = dsq; best = e; }
    }
    return best;
}

function onTick() {
    auraRefreshTick();

    if (module_Killaura.isActive()) {
        updateAuraRotationTarget();
        applyAuraRotation();
    } else {
        rotTarget = -1;
        rotTargetEntity = null;
    }

    if (!module_Killaura.isActive()) return;

    if (predetect.isActive()) {
        var near = getNearestEntityInRange(detectRadius.getCurrentValue());
        if (near) {
            if (presprint.isActive()) LocalPlayer.setSprinting(false);
            if (prejump.isActive() && LocalPlayer.isOnGround()) LocalPlayer.jump();
        }
    }

    var players = getValidPlayers();
    var modeKA = mode_KA.getCurrentMode();

    if (fixedTargetEntity) {
        var stillOk = entityInList(players, fixedTargetEntity);
        var dist = LocalPlayer.getDistanceTo(fixedTargetEntity);
        if (dist > auraTick.radiusPlus1 || !isValidTargetEntity(fixedTargetEntity)) {
            fixedTarget = -1;
            fixedTargetEntity = null;
            if (modeKA === "Switch") { switchTargets = []; switchIndex = 0; }
        } else if (!stillOk && dist > auraTick.radiusPlus1) {
            fixedTarget = -1;
            fixedTargetEntity = null;
            if (modeKA === "Switch") { switchTargets = []; switchIndex = 0; }
        }
    }

    if (modeKA === "Single") {
        if (!fixedTargetEntity || !isValidTargetEntity(fixedTargetEntity)) {
            fixedTargetEntity = players.length > 0 ? players[0] : null;
            fixedTarget = fixedTargetEntity ? fixedTargetEntity.getId() : -1;
        }
    }

    if (modeKA === "Switch") {
        if (switchTargets.length === 0) {
            switchTargets = players.slice();
            switchIndex = 0;
        }
        if (switchTargets.length > 0) {
            if (!fixedTargetEntity || !isValidTargetEntity(fixedTargetEntity)) {
                var found = false;
                for (var si = 0; si < switchTargets.length; si++) {
                    if (isValidTargetEntity(switchTargets[si])) {
                        switchIndex = si;
                        fixedTargetEntity = switchTargets[si];
                        fixedTarget = fixedTargetEntity.getId();
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    switchTargets = players.slice();
                    switchIndex = 0;
                    fixedTargetEntity = switchTargets.length > 0 ? switchTargets[0] : null;
                    fixedTarget = fixedTargetEntity ? fixedTargetEntity.getId() : -1;
                }
            }
            if (switchCooldown > 0) switchCooldown--;
        } else {
            fixedTarget = -1;
            fixedTargetEntity = null;
            switchCooldown = 0;
        }
    }

    if (!fixedTargetEntity) return;

    var now = Date.now();
    if (auraNextAttackDelay <= 0) rollAuraAttackDelay();

    if (now - lastAttackTime >= auraNextAttackDelay) {
        if (performAuraAttack()) {
            lastAttackTime = now;
            rollAuraAttackDelay();
            handlePostAttackActions();
        }
    }
}

function onAttack() {
    if (!module_Killaura.isActive()) return;
    if (noswing.isActive()) {
        LocalPlayer.addEffect(3, 2, 77, false);
        LocalPlayer.addEffect(4, 2, 10, false);
    }
    if (closeatt.isActive()) {
        var screen = Game.getScreenName();
        if (screen == "chat_screen" || screen == "large_chest_screen" || screen == "pause_screen"
            || screen == "survival_inventory_screen" || screen == "small_chest_screen") {
            Game.closeScreen();
        }
    }
    selectAutoSword();
}

module_Killaura.setOnToggleListener(function() {
    auraNextAttackDelay = 0;
    spookyPhase = 0;
});

function onScriptEnabled() {
    ModuleManager.addModule(module_Killaura);
    fixedTarget = -1;
    fixedTargetEntity = null;
    rotTarget = -1;
    rotTargetEntity = null;
    switchTargets = [];
    switchIndex = 0;
    auraNextAttackDelay = 0;
    swordSlotCache = -1;
    cachedPlayers = [];
    otherSectionVisible = false;
    preSectionVisible = false;
    fovSectionVisible = false;
    rotSectionVisible = false;
    hb_KA.setVisibility(false);
    autoSword.setVisibility(false);
    autoBlock.setVisibility(false);
    autoEquip.setVisibility(false);
    strafe.setVisibility(false);
    scaf.setVisibility(false);
    closeatt.setVisibility(false);
    noswing.setVisibility(false);
    predetect.setVisibility(false);
    presprint.setVisibility(false);
    precrit.setVisibility(false);
    prejump.setVisibility(false);
    detectRadius.setVisibility(false);
    fovSetting.setVisibility(false);
    fovXZ.setVisibility(false);
    fovY.setVisibility(false);
    rotationMode.setVisibility(false);
    rotSpeed.setVisibility(false);
    radiusRot.setVisibility(false);
    updateSpookyVisibility();
    updateCpsVisibility();
    lastPlayersUpdate = 0;
}

function onScriptDisabled() {
    ModuleManager.removeModule(module_Killaura);
}
