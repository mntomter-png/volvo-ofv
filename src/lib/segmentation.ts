/**
 * Postnummer → region/distrikt for fleet og markedsandel.
 * Gjenbruker OFV-segmenteringsmodulen i prosjektet.
 */
export {
  DIRECT_SALES_DEALER_CODE,
  getPostalCodeInfo,
  getRegionFromPostalCode,
  getTerritoryFromPostalCode,
  type TerritoryInfo,
} from "@/lib/ofv/segmentation";
