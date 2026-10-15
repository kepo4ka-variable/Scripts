var SPEED_CAT = 1;
try { SPEED_CAT = Constants.ModuleCategory.MOVEMENT; } catch (e) {}

var module_Speed = new Module("Speed", "Speed", true, SPEED_CAT);

var mode = new ModeSetting("Mode", ["Strafe", "Breadix", "BreadixNow", "Custom"]);
var speed = new SliderSetting("Speed", [0.40, 0.1, 1, 0.01]);
var groundSpeed = new SliderSetting("GroundSpeed", [0.3, 0.1, 1, 0.01]);
var friction = new SliderSetting("Friction", [8, 0, 10, 1]);
var stopJump = new SliderSetting("StopJump", [4, 1, 6, 1]);

var checkscaff = new StateSetting("disableinScaff", true);

var damageBoost = new StateSetting("DamageBoost", false);
var boostSpeed = new SliderSetting("BoostSpeed", [0.6, 0.1, 1, 0.1]);
var boostDuration = new SliderSetting("BoostDuration", [3, 0.1, 10, 0.1]);
var strafeOnDamage = new StateSetting("StrafeOnDamage", false);

var otherVisible = false;
var damageVisible = false;

var btnOther = new ButtonSetting("Other", function() {
    otherVisible = !otherVisible;
    checkscaff.setVisibility(otherVisible);
});

var btnDamage = new ButtonSetting("DamageBoost", function() {
    damageVisible = !damageVisible;
    damageBoost.setVisibility(damageVisible);
    boostSpeed.setVisibility(damageVisible);
    boostDuration.setVisibility(damageVisible);
    strafeOnDamage.setVisibility(damageVisible);
});

mode.setOnModeSelectedListener(function() {
    var custom = mode.getCurrentMode() === "Custom";
    groundSpeed.setVisibility(custom);
    friction.setVisibility(custom);
    stopJump.setVisibility(custom);
    speed.setVisibility(true);
});

function addAllSettings(mod, arr) {
    if (typeof mod.addSettings === "function") mod.addSettings(arr);
    else for (var i = 0; i < arr.length; i++) mod.addSetting(arr[i]);
}

addAllSettings(module_Speed, [
    mode, speed, groundSpeed, friction, stopJump,
    btnOther, checkscaff,
    btnDamage, damageBoost, boostSpeed, boostDuration, strafeOnDamage
]);

var speednew = 0;
var jumpTimer = 0;
var speedTick = 0;
var isBoostActive = false;
var boostTickCounter = 0;
var lastHealth = 20;

var VK_W = 87, VK_A = 65, VK_S = 83, VK_D = 68;

function isModuleActive(name) {
    try {
        var m = ModuleManager.getModule(name);
        return m ? m.isEnabled() : false;
    } catch (e) { return false; }
}

function hasPlayerNearby() {
    var pp = LocalPlayer.getPos();
    var myName = "";
    try { myName = ("" + LocalPlayer.getNameTag()).toLowerCase(); } catch (e) {}
    var players = Level.getPlayers();
    for (var i = 0; i < players.length; i++) {
        var e = players[i];
        if (!e) continue;
        try { if (!e.isAlive()) continue; } catch (e2) { continue; }
        var name = e.getNameTag();
        if (!name) continue;
        if (myName && ("" + name).toLowerCase().indexOf(myName) !== -1) continue;
        var ep = e.getPos();
        var dx = ep[0] - pp[0];
        var dy = ep[1] - pp[1];
        var dz = ep[2] - pp[2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 8) return true;
    }
    return false;
}

function checkDamageBoost() {
    if (!damageBoost.isActive()) return;
    var currentHealth = LocalPlayer.getHealth();
    if (currentHealth < lastHealth && hasPlayerNearby()) {
        isBoostActive = true;
        boostTickCounter = 0;
    }
    lastHealth = currentHealth;
    if (isBoostActive) {
        boostTickCounter++;
        if (boostTickCounter >= boostDuration.getCurrentValue() * 20) isBoostActive = false;
    }
}

function getMoveInput() {
    var f = Game.isKeyDown(VK_W);
    var b = Game.isKeyDown(VK_S);
    var l = Game.isKeyDown(VK_A);
    var r = Game.isKeyDown(VK_D);
    return { forward: f, back: b, left: l, right: r, any: f || b || l || r };
}

function setHorizontalVelocity(vel, yawDeg) {
    var rad = yawDeg * Math.PI / 180;
    LocalPlayer.setVelX(-vel * Math.sin(rad));
    LocalPlayer.setVelZ(vel * Math.cos(rad));
}

function onTick() {
    if (!module_Speed.isActive() || isModuleActive("Fly")) {
        speednew = 0;
        jumpTimer = 0;
        speedTick = 0;
        return;
    }
    if (checkscaff.isActive() && isModuleActive("AutoBlock")) return;

    checkDamageBoost();

    var input = getMoveInput();
    if (!input.any) {
        LocalPlayer.setVelX(0);
        LocalPlayer.setVelZ(0);
        return;
    }

    var moveYaw = LocalPlayer.getYaw();
    if (input.forward && input.left && !input.right && !input.back) moveYaw -= 45;
    else if (input.forward && input.right && !input.left && !input.back) moveYaw += 45;
    else if (input.back && input.left && !input.right && !input.forward) moveYaw -= 135;
    else if (input.back && input.right && !input.left && !input.forward) moveYaw += 135;
    else if (input.back && !input.left && !input.right && !input.forward) moveYaw += 180;
    else if (input.left && !input.forward && !input.back && !input.right) moveYaw -= 90;
    else if (input.right && !input.forward && !input.back && !input.left) moveYaw += 90;

    var currentSpeed = speed.getCurrentValue();
    var currentMode = mode.getCurrentMode();
    var boostVal = isBoostActive ? boostSpeed.getCurrentValue() : null;
    var strafeDamageActive = strafeOnDamage.isActive() && isBoostActive;

    if (strafeDamageActive) {
        setHorizontalVelocity(boostSpeed.getCurrentValue(), moveYaw);
        if (LocalPlayer.isOnGround()) LocalPlayer.jump();
        return;
    }

    if (currentMode === "Strafe") {
        setHorizontalVelocity(boostVal !== null ? boostVal : currentSpeed, moveYaw);
        if (LocalPlayer.isOnGround()) LocalPlayer.jump();
        return;
    }

    if (currentMode === "Breadix") {
        var fs = boostVal !== null ? boostVal : currentSpeed;
        speednew++;
        if (speednew <= 3) setHorizontalVelocity(fs, moveYaw);
        jumpTimer++;
        if (jumpTimer === 4) LocalPlayer.setVelY(0);
        if (LocalPlayer.isOnGround()) {
            LocalPlayer.jump();
            speednew = 0;
            jumpTimer = 0;
        }
        return;
    }

    if (currentMode === "BreadixNow") {
        var fs2 = boostVal !== null ? boostVal : currentSpeed;
        if (LocalPlayer.isOnGround()) setHorizontalVelocity(fs2, moveYaw);
        return;
    }

    if (currentMode === "Custom") {
        var fs3 = boostVal !== null ? boostVal : currentSpeed;
        if (!LocalPlayer.isOnGround() && speedTick > 0) {
            setHorizontalVelocity(fs3, moveYaw);
            speedTick--;
        }
        if (LocalPlayer.isOnGround()) {
            LocalPlayer.jump();
            var gs = boostVal !== null ? boostVal : groundSpeed.getCurrentValue();
            setHorizontalVelocity(gs, moveYaw);
            speedTick = friction.getCurrentValue();
            jumpTimer = 0;
        } else {
            jumpTimer++;
            if (jumpTimer === stopJump.getCurrentValue() && jumpTimer !== 6) {
                LocalPlayer.setVelY(0);
            }
        }
    }
}

function onScriptEnabled() {
    ModuleManager.addModule(module_Speed);
    speednew = 0;
    jumpTimer = 0;
    speedTick = 0;
    isBoostActive = false;
    lastHealth = LocalPlayer.getHealth();
    groundSpeed.setVisibility(false);
    friction.setVisibility(false);
    stopJump.setVisibility(false);
    checkscaff.setVisibility(false);
    damageBoost.setVisibility(false);
    boostSpeed.setVisibility(false);
    boostDuration.setVisibility(false);
    strafeOnDamage.setVisibility(false);
}

function onScriptDisabled() {
    ModuleManager.removeModule(module_Speed);
    speednew = 0;
    jumpTimer = 0;
    speedTick = 0;
    isBoostActive = false;
}
