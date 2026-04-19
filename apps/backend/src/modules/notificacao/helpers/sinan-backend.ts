export function calcularSemanaEpidemiologica(dataISO: string): number {
  const date = new Date(dataISO + 'T12:00:00');
  const dayOfWeek = date.getDay();
  const sundayOfWeek = new Date(date);
  sundayOfWeek.setDate(date.getDate() - dayOfWeek);

  const jan1 = new Date(date.getFullYear(), 0, 1, 12);
  const firstSunday = new Date(jan1);
  firstSunday.setDate(jan1.getDate() - jan1.getDay());

  const diffMs = sundayOfWeek.getTime() - firstSunday.getTime();
  const weekNumber = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  if (weekNumber < 1) return calcularSemanaEpidemiologica(`${date.getFullYear() - 1}-12-31`);
  return weekNumber;
}

const AGRAVO_CID: Record<string, string> = {
  dengue:      'A90',
  chikungunya: 'A92.0',
  zika:        'A92.8',
};

export interface ESUSPayload {
  codigoMunicipio:       string;
  codigoCnes:            string;
  dataNotificacao:       string;
  dataInicioSintomas:    string;
  municipioResidencia:   string;
  semanaEpidemiologica:  number;
  agravo:                string;
  classificacaoFinal:    number;
  criterioConfirmacao:   number;
  logradouro?:           string;
  latitude?:             number;
  longitude?:            number;
}

export function montarPayloadESUS(
  item: {
    enderecoCompleto?: string | null;
    enderecoCurto?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    dataHora?: string | null;
    dataInicioSintomas?: string | null;
  },
  codigoIbge: string,
  cnes: string,
  tipoAgravo: string,
): ESUSPayload {
  const dataNotificacao = item.dataHora
    ? item.dataHora.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const dataInicioSintomas = item.dataInicioSintomas?.slice(0, 10) ?? dataNotificacao;

  return {
    codigoMunicipio:      codigoIbge,
    codigoCnes:           cnes,
    dataNotificacao,
    dataInicioSintomas,
    municipioResidencia:  codigoIbge,
    semanaEpidemiologica: calcularSemanaEpidemiologica(dataNotificacao),
    agravo:               AGRAVO_CID[tipoAgravo] ?? tipoAgravo,
    classificacaoFinal:   2,
    criterioConfirmacao:  2,
    logradouro: item.enderecoCompleto ?? item.enderecoCurto ?? undefined,
    latitude:   item.latitude  ?? undefined,
    longitude:  item.longitude ?? undefined,
  };
}
