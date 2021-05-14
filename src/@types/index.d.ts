import { allUnits, UnitFamilies } from "convert";
import { MarkdownView } from "obsidian";
import { DivIconMarker, MarkerDivIcon } from "./map";
import { LeafletMap } from "./map";

export { ObsidianLeaflet } from "./main";
export { LeafletMap, Marker } from "./map";

/** Recreate Length Alias Types from "convert" */
declare type UnitsCombined = typeof allUnits;
declare type UnitKeys = Exclude<keyof UnitsCombined, "__proto__">;
declare type AllValues = {
    [P in UnitKeys]: {
        key: P;
        value: UnitsCombined[P][0];
    };
}[UnitKeys];
declare type IdToFamily = {
    [P in AllValues["value"]]: Extract<
        AllValues,
        {
            value: P;
        }
    >["key"];
};
declare type GetAliases<X extends UnitFamilies> = IdToFamily[X];
export type Length = GetAliases<UnitFamilies.Length>;

/** Leaflet Interfaces */

export interface ILeafletMapOptions {
    id?: string;
    minZoom?: number;
    maxZoom?: number;
    defaultZoom?: number;
    zoomDelta?: number;
    unit?: string;
    scale?: number;
    distanceMultiplier?: number;
    darkMode?: boolean;
    tileServer?: string;
}

export interface MarkerDivIconOptions extends L.DivIconOptions {
    data?: { [key: string]: string };
}

export interface DivIconMarkerOptions extends L.MarkerOptions {
    icon: MarkerDivIcon;
}

export interface IMarker {
    type: string;
    iconName: string;
    color?: string;
    layer?: boolean;
    transform?: { size: number; x: number; y: number };
}
export interface ILeafletMarker {
    type: string;
    loc: L.LatLng;
    id: string;
    link?: string;
    leafletInstance: DivIconMarker;
    layer: string;
    mutable: boolean;
    command: boolean;
}

export interface IMarkerData {
    type: string;
    loc: [number, number];
    id: string;
    link: string;
    layer: string;
    command: boolean;
    zoom?: number;
}

export interface IMapInterface {
    map: LeafletMap;
    path?: string;
    file?: string;
    view: MarkdownView;
    source: string;
    el: HTMLElement;
    id: string;
}
export interface IMapMarkerData {
    path?: string;
    file?: string;
    files: string[];
    lastAccessed: number;
    id: string;
    markers: IMarkerData[];
}
export interface IMarkerIcon {
    readonly type: string;
    readonly html: string;
    readonly icon: MarkerDivIcon;
}

export interface ILayerGroup {
    group: L.LayerGroup;
    layer: L.TileLayer | L.ImageOverlay;
    id: string;
    data: string;
}

/** Settings Interfaces */
export interface IObsidianAppData {
    mapMarkers: IMapMarkerData[];
    markerIcons: IMarker[];
    defaultMarker: IMarker;
    color: string;
    lat: number;
    long: number;
    notePreview: boolean;
    layerMarkers: boolean;
    previousVersion: string;
    warnedAboutMapMarker: boolean;
    copyOnClick: boolean;
}
