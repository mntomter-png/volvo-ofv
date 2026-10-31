/**
 * Drivlinje-telling fra tmf_monthly_market.
 *
 * Diesel er bare diesel. Hydrogen og alt som ikke er elektrisk, diesel eller
 * gass ligger i annet — klassifiseringen skjer i SQL, se migrasjonen
 * tmf_drivetrain_diesel_gas_other. Rader som mangler de nye tellingene
 * (eldre fixtures) legger resten i annet, ikke i diesel, så den gamle
 * ICE-resten ikke forsvinner og ikke blir til diesel.
 */
export interface TmfDrivetrainCounts {
  total: number;
  emob: number;
  diesel: number;
  gas: number;
  other: number;
}

export interface TmfDrivetrainShares {
  emobSharePct: number;
  dieselSharePct: number;
  gasSharePct: number;
  otherSharePct: number;
}

export interface TmfDrivetrainVolumes extends TmfDrivetrainShares {
  annualEmob: number;
  annualDiesel: number;
  annualGas: number;
  annualOther: number;
  /** Diesel + gass + annet. Samme rest som tidligere ICE. */
  annualIce: number;
}

interface DrivetrainRow {
  count: number;
  emob_count?: number;
  diesel_count?: number;
  gas_count?: number;
  other_count?: number;
}

export function partitionDrivetrainCounts(rows: DrivetrainRow[]): TmfDrivetrainCounts {
  let total = 0;
  let emob = 0;
  let diesel = 0;
  let gas = 0;
  let explicitOther = 0;

  for (const row of rows) {
    total += row.count;
    emob += row.emob_count ?? 0;
    diesel += row.diesel_count ?? 0;
    gas += row.gas_count ?? 0;
    explicitOther += row.other_count ?? 0;
  }

  const uncovered = total - emob - diesel - gas - explicitOther;
  return {
    total,
    emob,
    diesel,
    gas,
    other: explicitOther + Math.max(0, uncovered),
  };
}

export function drivetrainShares(counts: TmfDrivetrainCounts): TmfDrivetrainShares {
  if (counts.total <= 0) {
    return {
      emobSharePct: 0,
      dieselSharePct: 0,
      gasSharePct: 0,
      otherSharePct: 0,
    };
  }

  return {
    emobSharePct: (counts.emob / counts.total) * 100,
    dieselSharePct: (counts.diesel / counts.total) * 100,
    gasSharePct: (counts.gas / counts.total) * 100,
    otherSharePct: (counts.other / counts.total) * 100,
  };
}

/** Mekanisk split: trailing-andel ganget med årsvolumet. Endrer ikke totalen. */
export function annualDrivetrainVolumes(
  annualVolume: number,
  shares: TmfDrivetrainShares,
): TmfDrivetrainVolumes {
  const annualEmob = annualVolume * (shares.emobSharePct / 100);
  const annualDiesel = annualVolume * (shares.dieselSharePct / 100);
  const annualGas = annualVolume * (shares.gasSharePct / 100);
  const annualOther = annualVolume * (shares.otherSharePct / 100);

  // Bare drivlinjefeltene. Baseline har også volvoSharePct, og en spread
  // ville skrevet over andelen etter at ordreinngang er lagt på.
  return {
    emobSharePct: shares.emobSharePct,
    dieselSharePct: shares.dieselSharePct,
    gasSharePct: shares.gasSharePct,
    otherSharePct: shares.otherSharePct,
    annualEmob,
    annualDiesel,
    annualGas,
    annualOther,
    annualIce: annualDiesel + annualGas + annualOther,
  };
}

export function sumDrivetrainVolumes(
  parts: TmfDrivetrainVolumes[],
  annualVolume: number,
): TmfDrivetrainVolumes {
  const annualEmob = parts.reduce((sum, part) => sum + part.annualEmob, 0);
  const annualDiesel = parts.reduce((sum, part) => sum + part.annualDiesel, 0);
  const annualGas = parts.reduce((sum, part) => sum + part.annualGas, 0);
  const annualOther = parts.reduce((sum, part) => sum + part.annualOther, 0);

  return {
    annualEmob,
    annualDiesel,
    annualGas,
    annualOther,
    annualIce: annualDiesel + annualGas + annualOther,
    emobSharePct: annualVolume > 0 ? (annualEmob / annualVolume) * 100 : 0,
    dieselSharePct: annualVolume > 0 ? (annualDiesel / annualVolume) * 100 : 0,
    gasSharePct: annualVolume > 0 ? (annualGas / annualVolume) * 100 : 0,
    otherSharePct: annualVolume > 0 ? (annualOther / annualVolume) * 100 : 0,
  };
}
