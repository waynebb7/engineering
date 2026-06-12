/**
 * Power Wire Analysis — Advanced Thermal Heat-Balance Model
 *
 * Supplementary physics-based conductor temperature estimation.
 * Does NOT replace or modify ARP4404 / AC 43.13 / AS50881 primary methodology.
 * All internal calculations use SI units unless noted.
 */
(function (global) {
  'use strict';

  var STEFAN_BOLTZMANN = 5.670374419e-8; // W/(m²·K⁴)
  var FT_TO_M = 0.3048;
  var ISA_SEA_LEVEL_PRESSURE = 101325; // Pa
  var ISA_SEA_LEVEL_TEMP = 288.15; // K
  var ISA_LAPSE_RATE = 0.0065; // K/m
  var ISA_GAS_CONSTANT = 287.05287; // J/(kg·K)
  var ISA_GRAVITY = 9.80665;
  var MAX_ALTITUDE_FT = 86000;
  var CONVERGENCE_TEMP_C = 0.01;
  var MAX_ITERATIONS = 100;

  var MATERIAL_ALPHA = {
    copper: 0.00393,
    aluminium: 0.00403
  };

  var INSTALLATION_TYPES = {
    freeAir: { label: 'Free Air', hBase: 18, exposure: 1.0 },
    openHarness: { label: 'Open Harness', hBase: 14, exposure: 0.85 },
    bundledHarness: { label: 'Bundled Harness', hBase: 10, exposure: 0.55 },
    conduit: { label: 'Conduit', hBase: 8, exposure: 0.40 },
    cableTray: { label: 'Cable Tray', hBase: 12, exposure: 0.70 },
    structureClamped: { label: 'Structure Clamped', hBase: 6, exposure: 0.35 }
  };

  var WIRE_POSITIONS = {
    outer: { label: 'Outer Bundle', factor: 1.0 },
    mid: { label: 'Mid Bundle', factor: 1.10 },
    centre: { label: 'Centre Bundle', factor: 1.20 }
  };

  var EMISSIVITY_PRESETS = {
    conservative: { label: 'Conservative Aerospace Default (0.80)', value: 0.80 },
    ptfe: { label: 'PTFE (0.85)', value: 0.85 },
    etfe: { label: 'ETFE (0.90)', value: 0.90 },
    xletfe: { label: 'XL-ETFE (0.90)', value: 0.90 },
    custom: { label: 'Custom', value: null }
  };

  var INSULATION_K_PRESETS = {
    conservative: { label: 'Conservative Default', value: 0.20 },
    ptfe: { label: 'PTFE', value: 0.25 },
    etfe: { label: 'ETFE', value: 0.23 },
    xletfe: { label: 'XL-ETFE', value: 0.22 },
    custom: { label: 'Custom', value: null }
  };

  var DUTY_CYCLE_PRESETS = {
    continuous: { label: 'Continuous', value: 100 },
    duty75: { label: '75%', value: 75 },
    duty50: { label: '50%', value: 50 },
    duty25: { label: '25%', value: 25 },
    custom: { label: 'Custom', value: null }
  };

  var THERMAL_CONTACT = {
    none: { label: 'None', gCondPerM: 0 },
    light: { label: 'Light Contact', gCondPerM: 0.8 },
    moderate: { label: 'Moderate Contact', gCondPerM: 2.0 },
    strong: { label: 'Strong Contact', gCondPerM: 4.5 }
  };

  var DISCLAIMER =
    'This model is a supplementary engineering substantiation tool and does not replace ' +
    'the primary ARP4404 / AC43.13 / AS50881 based sizing methodology used elsewhere in this calculator.';

  function kelvin(celsius) {
    return celsius + 273.15;
  }

  function round(value, digits) {
    if (typeof value !== 'number' || !isFinite(value)) {
      return null;
    }
    var factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
  }

  /**
   * International Standard Atmosphere (ISA) — troposphere model.
   * Altitude input in feet; returns SI density (kg/m³) and pressure (Pa).
   */
  function computeIsaAtmosphere(altitudeFt) {
    var altitudeM = Math.max(0, altitudeFt) * FT_TO_M;
    var temperatureK;
    var pressurePa;

    if (altitudeM <= 11000) {
      temperatureK = ISA_SEA_LEVEL_TEMP - ISA_LAPSE_RATE * altitudeM;
      pressurePa = ISA_SEA_LEVEL_PRESSURE * Math.pow(
        temperatureK / ISA_SEA_LEVEL_TEMP,
        ISA_GRAVITY / (ISA_GAS_CONSTANT * ISA_LAPSE_RATE)
      );
    } else {
      temperatureK = 216.65;
      var pressure11 = ISA_SEA_LEVEL_PRESSURE * Math.pow(
        (ISA_SEA_LEVEL_TEMP - ISA_LAPSE_RATE * 11000) / ISA_SEA_LEVEL_TEMP,
        ISA_GRAVITY / (ISA_GAS_CONSTANT * ISA_LAPSE_RATE)
      );
      pressurePa = pressure11 * Math.exp(
        (-ISA_GRAVITY * (altitudeM - 11000)) / (ISA_GAS_CONSTANT * temperatureK)
      );
    }

    var density = pressurePa / (ISA_GAS_CONSTANT * temperatureK);
    return {
      altitudeFt: altitudeFt,
      altitudeM: altitudeM,
      temperatureK: temperatureK,
      temperatureC: temperatureK - 273.15,
      pressurePa: pressurePa,
      densityKgM3: density
    };
  }

  function estimateAdjacentLoadedWires(bundleWireCount, bundleLoadingPct) {
    var count = Math.max(1, bundleWireCount || 1);
    var loading = Math.max(0, Math.min(100, bundleLoadingPct || 0)) / 100;
    return Math.max(1, Math.round(count * loading));
  }

  function effectiveConvectionCoeff(hBase, airVelocityMs, densityKgM3) {
    var densityFactor = Math.sqrt(Math.max(densityKgM3, 0.4) / 1.225);
    var natural = hBase * densityFactor;
    var forced = 0.8 * Math.max(0, airVelocityMs) * densityFactor;
    return natural + forced;
  }

  function wireSurfaceAreaM2(odAvgMm, lengthM, exposure) {
    var diameterM = Math.max(odAvgMm, 0.5) / 1000;
    return Math.PI * diameterM * Math.max(lengthM, 0.01) * Math.max(exposure, 0.1);
  }

  function resistanceAtTemp(r20Ohms, alpha, tempC) {
    return r20Ohms * (1 + alpha * (tempC - 20));
  }

  function heatGeneratedW(currentA, resistanceOhms) {
    return currentA * currentA * resistanceOhms;
  }

  function heatConvectionW(h, areaM2, tc, tamb) {
    var delta = tc - tamb;
    return h * areaM2 * Math.max(delta, 0);
  }

  function heatRadiationW(emissivity, areaM2, tc, tamb) {
    var tcK = kelvin(tc);
    var tambK = kelvin(tamb);
    return emissivity * STEFAN_BOLTZMANN * areaM2 * (Math.pow(tcK, 4) - Math.pow(tambK, 4));
  }

  function heatConductionW(gCond, tc, tSurface) {
    var delta = tc - tSurface;
    return gCond * Math.max(delta, 0);
  }

  function dominantMechanism(qConv, qRad, qCond) {
    var total = qConv + qRad + qCond;
    if (total <= 0) {
      return 'Mixed Mode';
    }
    var max = Math.max(qConv, qRad, qCond);
    if (max / total < 0.55) {
      return 'Mixed Mode';
    }
    if (max === qConv) {
      return 'Convection Dominated';
    }
    if (max === qRad) {
      return 'Radiation Dominated';
    }
    return 'Conduction Dominated';
  }

  function comparisonStatus(percentDiff) {
    var absPct = Math.abs(percentDiff);
    if (absPct < 5) {
      return 'Comparable';
    }
    if (absPct <= 15) {
      return 'Moderately Different';
    }
    return 'Significantly Different';
  }

  function validateInputs(inputs) {
    var warnings = [];
    if (inputs.ambientTempC < 0) {
      warnings.push('Ambient temperature is below 0 °C — verify model applicability.');
    }
    if (inputs.airVelocityMs < 0) {
      warnings.push('Air velocity cannot be negative.');
    }
    if (inputs.emissivity < 0 || inputs.emissivity > 1) {
      warnings.push('Emissivity must be between 0 and 1.');
    }
    if (inputs.dutyCyclePct <= 0 || inputs.dutyCyclePct > 100) {
      warnings.push('Duty cycle must be between 0 and 100%.');
    }
    if (inputs.altitudeFt > MAX_ALTITUDE_FT) {
      warnings.push('Altitude exceeds supported ISA model range (' + MAX_ALTITUDE_FT + ' ft).');
    }
    if (inputs.currentA <= 0) {
      warnings.push('Circuit current must be positive for thermal analysis.');
    }
    if (inputs.r20Ohms <= 0) {
      warnings.push('Wire resistance is invalid for thermal analysis.');
    }
    return warnings;
  }

  /**
   * Solve steady-state conductor temperature by bisection on Tc.
   * Finds Tc where Q_gen(Tc) = Q_conv + Q_rad + Q_cond within 0.01 °C.
   */
  function solveHeatBalance(inputs) {
    var warnings = validateInputs(inputs);
    var alpha = MATERIAL_ALPHA[inputs.material] || MATERIAL_ALPHA.copper;
    var install = INSTALLATION_TYPES[inputs.installationType] || INSTALLATION_TYPES.freeAir;
    var position = WIRE_POSITIONS[inputs.wirePosition] || WIRE_POSITIONS.centre;
    var contact = THERMAL_CONTACT[inputs.thermalContact] || THERMAL_CONTACT.none;
    var atmosphere = computeIsaAtmosphere(inputs.altitudeFt);
    var lengthM = Math.max(inputs.runLengthM, 0.01);
    var areaM2 = wireSurfaceAreaM2(inputs.odAvgMm, lengthM, install.exposure);
    var h = effectiveConvectionCoeff(install.hBase, inputs.airVelocityMs, atmosphere.densityKgM3);
    var dutyFactor = Math.sqrt(Math.max(inputs.dutyCyclePct, 0) / 100);
    var currentEff = inputs.currentA * dutyFactor;
    var neighborPenalty = 1 + 0.025 * Math.max(0, inputs.adjacentLoadedWires - 1);
    var positionPenalty = position.factor;
    var gCond = contact.gCondPerM * lengthM;

    function lossesAt(tempC) {
      var qConv = heatConvectionW(h, areaM2, tempC, inputs.ambientTempC);
      var qRad = heatRadiationW(inputs.emissivity, areaM2, tempC, inputs.ambientTempC);
      var qCond = heatConductionW(gCond, tempC, inputs.hotSurfaceTempC);
      var total = (qConv + qRad + qCond) / (positionPenalty * neighborPenalty);
      return {
        qConv: qConv,
        qRad: qRad,
        qCond: qCond,
        total: total
      };
    }

    function balanceAt(tempC) {
      var r = resistanceAtTemp(inputs.r20Ohms, alpha, tempC);
      var qGen = heatGeneratedW(currentEff, r);
      var losses = lossesAt(tempC);
      return {
        qGen: qGen,
        losses: losses,
        residual: qGen - losses.total
      };
    }

    var tLow = inputs.ambientTempC;
    var tHigh = Math.max(inputs.conductorRatingC, inputs.ambientTempC + 50);
    var lowBal = balanceAt(tLow);
    var highBal = balanceAt(tHigh);
    var converged = false;
    var iterations = 0;
    var tc = tHigh;

    if (lowBal.residual <= 0) {
      tc = tLow;
      converged = true;
    } else if (highBal.residual <= 0) {
      while (iterations < MAX_ITERATIONS && (tHigh - tLow) > CONVERGENCE_TEMP_C) {
        iterations += 1;
        tc = (tLow + tHigh) / 2;
        var midBal = balanceAt(tc);
        if (midBal.residual > 0) {
          tLow = tc;
        } else {
          tHigh = tc;
        }
      }
      converged = (tHigh - tLow) <= CONVERGENCE_TEMP_C;
      tc = (tLow + tHigh) / 2;
    } else {
      tc = tHigh;
      warnings.push('Heat generation exceeds rejection across the analysis range — result capped at conductor rating.');
    }

    if (!converged) {
      warnings.push('Advanced thermal model did not converge within ' + MAX_ITERATIONS + ' iterations.');
    }

    var finalBal = balanceAt(tc);
    var ratingMargin = inputs.conductorRatingC - tc;
    var installLimit = inputs.installationLimitC;
    var installMargin = installLimit != null ? installLimit - tc : null;
    var utilisation = (tc / inputs.conductorRatingC) * 100;
    var passRating = tc <= inputs.conductorRatingC;
    var passInstall = installLimit == null || tc <= installLimit;

    return {
      enabled: true,
      converged: converged,
      iterations: iterations,
      warnings: warnings,
      awg: inputs.awg,
      wireTypeLabel: inputs.wireTypeLabel,
      tcAdvanced: round(tc, 3),
      existingT2: round(inputs.existingT2C, 3),
      differenceC: round(tc - inputs.existingT2C, 3),
      differencePct: inputs.existingT2C
        ? round(((tc - inputs.existingT2C) / inputs.existingT2C) * 100, 2)
        : null,
      comparisonStatus: inputs.existingT2C
        ? comparisonStatus(((tc - inputs.existingT2C) / inputs.existingT2C) * 100)
        : '—',
      ratingMarginC: round(ratingMargin, 3),
      installMarginC: installMargin != null ? round(installMargin, 3) : null,
      thermalUtilisationPct: round(utilisation, 2),
      dominantMechanism: dominantMechanism(
        finalBal.losses.qConv,
        finalBal.losses.qRad,
        finalBal.losses.qCond
      ),
      heatBalance: {
        qGenW: round(finalBal.qGen, 4),
        qConvW: round(finalBal.losses.qConv, 4),
        qRadW: round(finalBal.losses.qRad, 4),
        qCondW: round(finalBal.losses.qCond, 4),
        qLossTotalW: round(finalBal.losses.total, 4),
        residualW: round(finalBal.residual, 4)
      },
      atmosphere: {
        densityKgM3: round(atmosphere.densityKgM3, 5),
        pressurePa: round(atmosphere.pressurePa, 1),
        pressureKPa: round(atmosphere.pressurePa / 1000, 3)
      },
      passRating: passRating,
      passInstall: passInstall,
      passFail: passRating && passInstall ? 'PASS' : 'FAIL',
      inputs: inputs,
      assumptions: inputs.assumptions || []
    };
  }

  global.PwaAdvancedThermal = {
    DISCLAIMER: DISCLAIMER,
    INSTALLATION_TYPES: INSTALLATION_TYPES,
    WIRE_POSITIONS: WIRE_POSITIONS,
    EMISSIVITY_PRESETS: EMISSIVITY_PRESETS,
    INSULATION_K_PRESETS: INSULATION_K_PRESETS,
    DUTY_CYCLE_PRESETS: DUTY_CYCLE_PRESETS,
    THERMAL_CONTACT: THERMAL_CONTACT,
    MATERIAL_ALPHA: MATERIAL_ALPHA,
    MAX_ALTITUDE_FT: MAX_ALTITUDE_FT,
    computeIsaAtmosphere: computeIsaAtmosphere,
    estimateAdjacentLoadedWires: estimateAdjacentLoadedWires,
    solveHeatBalance: solveHeatBalance,
    comparisonStatus: comparisonStatus,
    round: round
  };
})(typeof window !== 'undefined' ? window : this);
