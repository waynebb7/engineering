(function (global) {
  'use strict';

  // Datasheet values are Ohm/km @ 20 °C; calculator grid uses Ohm/1000 ft.
  var OHM_KM_TO_OHM_1000FT = 1000 / 3280.8398950131;

  function ohm1000ftFromKm(ohmPerKm) {
    return ohmPerKm * OHM_KM_TO_OHM_1000FT;
  }

  var WIRE_TYPES = [
    {
      id: 'kp260',
      label: 'KP260 (K.Lacey)',
      manufacturer: 'K.Lacey Cables',
      brandSpec: 'Brand-Rex HPECM44',
      construction:
        'Nickel plated copper wire conductor (24 AWG is nickel plated copper alloy). ' +
        'Polyimide/FEP taped insulation with taped PTFE finish.',
      operatingTemp: '-65 °C to +260 °C',
      voltageRating: '600 V r.m.s. @ 2000 Hz',
      defaultConductorTempRating: 260,
      specPage: 'wire-specification.html?wire=kp260',
      documentFile: '../../reference/documents/files/klacey-kp260-wire-specification.pdf',
      awgSizes: [
        { awg: '24', strand: '19/0.12', conductorNomDiaMm: 0.56, ohmPerKm: 114.70, odMinMm: 0.98, odMaxMm: 1.16, ampRatingMax: 6.50, weightKgPerKm: 3.55 },
        { awg: '22', strand: '19/0.15', conductorNomDiaMm: 0.74, ohmPerKm: 58.80, odMinMm: 1.10, odMaxMm: 1.32, ampRatingMax: 9.00, weightKgPerKm: 4.90 },
        { awg: '20', strand: '19/0.20', conductorNomDiaMm: 0.96, ohmPerKm: 32.80, odMinMm: 1.35, odMaxMm: 1.55, ampRatingMax: 13.00, weightKgPerKm: 7.70 },
        { awg: '18', strand: '19/0.25', conductorNomDiaMm: 1.21, ohmPerKm: 20.80, odMinMm: 1.60, odMaxMm: 1.80, ampRatingMax: 17.00, weightKgPerKm: 11.30 },
        { awg: '16', strand: '19/0.30', conductorNomDiaMm: 1.44, ohmPerKm: 14.40, odMinMm: 1.80, odMaxMm: 2.05, ampRatingMax: 21.00, weightKgPerKm: 15.80 },
        { awg: '14', strand: '37/0.25', conductorNomDiaMm: 1.71, ohmPerKm: 10.60, odMinMm: 2.10, odMaxMm: 2.40, ampRatingMax: 27.00, weightKgPerKm: 21.00 },
        { awg: '12', strand: '37/0.32', conductorNomDiaMm: 2.15, ohmPerKm: 6.60, odMinMm: 2.50, odMaxMm: 2.90, ampRatingMax: 35.00, weightKgPerKm: 32.00 },
        { awg: '10', strand: '37/0.40', conductorNomDiaMm: 2.74, ohmPerKm: 4.13, odMinMm: 3.20, odMaxMm: 3.70, ampRatingMax: 44.00, weightKgPerKm: 53.00 },
        { awg: '8', strand: '119/0.30', conductorNomDiaMm: 4.20, ohmPerKm: 2.40, odMinMm: 4.80, odMaxMm: 5.30, ampRatingMax: 63.00, weightKgPerKm: 93.00 },
        { awg: '6', strand: '182/0.30', conductorNomDiaMm: 5.15, ohmPerKm: 1.57, odMinMm: 5.80, odMaxMm: 6.30, ampRatingMax: 96.00, weightKgPerKm: 140.00 },
        { awg: '4', strand: '294/0.30', conductorNomDiaMm: 6.60, ohmPerKm: 0.971, odMinMm: 7.10, odMaxMm: 7.70, ampRatingMax: 140.00, weightKgPerKm: 217.00 },
        { awg: '2', strand: '203/0.45', conductorNomDiaMm: 8.30, ohmPerKm: 0.606, odMinMm: 8.80, odMaxMm: 9.40, ampRatingMax: 195.00, weightKgPerKm: 330.00 },
        { awg: '1', strand: '245/0.45', conductorNomDiaMm: 9.35, ohmPerKm: 0.50, odMinMm: 9.70, odMaxMm: 10.40, ampRatingMax: 220.00, weightKgPerKm: 400.00 },
        { awg: '0', strand: '322/0.45', conductorNomDiaMm: 10.50, ohmPerKm: 0.381, odMinMm: 10.90, odMaxMm: 11.70, ampRatingMax: 260.00, weightKgPerKm: 525.00 },
        { awg: '00', strand: '420/0.45', conductorNomDiaMm: 11.80, ohmPerKm: 0.290, odMinMm: 12.30, odMaxMm: 13.20, ampRatingMax: 300.00, weightKgPerKm: 680.00 },
        { awg: '000', strand: '518/0.45', conductorNomDiaMm: 13.40, ohmPerKm: 0.237, odMinMm: 14.00, odMaxMm: 14.80, ampRatingMax: 345.00, weightKgPerKm: 835.00 },
        { awg: '0000', strand: '665/0.45', conductorNomDiaMm: 14.80, ohmPerKm: 0.190, odMinMm: 15.60, odMaxMm: 16.40, ampRatingMax: 380.00, weightKgPerKm: 1060.00 }
      ]
    }
  ];

  function findWireType(wireTypeId) {
    for (var i = 0; i < WIRE_TYPES.length; i += 1) {
      if (WIRE_TYPES[i].id === wireTypeId) {
        return WIRE_TYPES[i];
      }
    }
    return null;
  }

  function buildWireRows(wireType) {
    if (!wireType || !wireType.awgSizes) return [];
    return wireType.awgSizes.map(function (size) {
      return {
        label: size.awg,
        ohmPerKm: size.ohmPerKm,
        ohm1000ft: ohm1000ftFromKm(size.ohmPerKm),
        strand: size.strand,
        conductorNomDiaMm: size.conductorNomDiaMm,
        odMinMm: size.odMinMm,
        odMaxMm: size.odMaxMm,
        ampRatingMax: size.ampRatingMax,
        weightKgPerKm: size.weightKgPerKm
      };
    });
  }

  function listWireTypes() {
    return WIRE_TYPES.map(function (wireType) {
      return {
        id: wireType.id,
        label: wireType.label
      };
    });
  }

  global.PwaWireCatalog = {
    WIRE_TYPES: WIRE_TYPES,
    OHM_KM_TO_OHM_1000FT: OHM_KM_TO_OHM_1000FT,
    ohm1000ftFromKm: ohm1000ftFromKm,
    getWireType: findWireType,
    getWireRows: function (wireTypeId) {
      return buildWireRows(findWireType(wireTypeId));
    },
    listWireTypes: listWireTypes
  };
})(typeof window !== 'undefined' ? window : this);
