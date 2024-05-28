const MERCATOR_WIDTH = 256;

function getBounds(waypoints: Array<[number, number]>, directionCoordinates: undefined | Array<[number, number]>): {southWest: [number, number]; northEast: [number, number]} {
    const lngs = waypoints.map((waypoint) => waypoint[0]);
    const lats = waypoints.map((waypoint) => waypoint[1]);
    if (directionCoordinates) {
        lngs.push(...directionCoordinates.map((coordinate) => coordinate[0]));
        lats.push(...directionCoordinates.map((coordinate) => coordinate[1]));
    }

    return {
        southWest: [Math.min(...lngs), Math.min(...lats)],
        northEast: [Math.max(...lngs), Math.max(...lats)],
    };
}

function colorStrToInt(color: string): number {
    return Number(color.replace('#', '0x'));
}

function headingToFit(northEastLon: number, southWestLon: number, mapWidth: number): number {
    let azimuthDeg = northEastLon - southWestLon;
    if (azimuthDeg < 0) {
        azimuthDeg += 360;
    }

    return Math.round(Math.log((mapWidth * 360) / azimuthDeg / MERCATOR_WIDTH) / Math.LN2);
}

export default {
    getBounds,
    colorStrToInt,
    headingToFit,
};
