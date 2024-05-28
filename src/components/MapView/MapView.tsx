/* eslint-disable no-nested-ternary */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type {OmhCoordinate, OmhMapProvider, OmhMapViewRef} from '@openmobilehub/maps-core';
import {OmhMapsAppleMapsIOSProvider, OmhMapsGoogleMapsIOSProvider, OmhMapsLocationModule, OmhMapsModule, OmhMapView, OmhMarker, OmhPolyline} from '@openmobilehub/maps-core';
import {OmhMapsAzureMapsProvider} from '@openmobilehub/maps-plugin-azuremaps';
import {OmhMapsGoogleMapsProvider} from '@openmobilehub/maps-plugin-googlemaps';
import {OmhMapsMapboxProvider} from '@openmobilehub/maps-plugin-mapbox';
import {OmhMapsOpenStreetMapProvider} from '@openmobilehub/maps-plugin-openstreetmap';
import {useFocusEffect} from '@react-navigation/native';
import _ from 'lodash';
import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Platform, View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import stopMarkerIcon from '@assets/images/map-marker-stop-icon.png';
import ButtonWithDropdownMenu from '@components/ButtonWithDropdownMenu';
import compose from '@libs/compose';
import colors from '@styles/theme/colors';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import CONFIG from '../../CONFIG';
import type {ComponentProps, MapViewOnyxProps} from './types';
import utils from './utils';

// set up default providers
OmhMapsModule.initialize({
    iosProvider: OmhMapsAppleMapsIOSProvider,
    gmsProvider: OmhMapsGoogleMapsProvider,
    nonGmsProvider: OmhMapsOpenStreetMapProvider,
});

// setup up access tokens for Android providers
if (Platform.OS === 'android') {
    require('@openmobilehub/maps-plugin-mapbox').OmhMapsPluginMapboxModule.setPublicToken(CONFIG.MAPBOX_PUBLIC_TOKEN);
    require('@openmobilehub/maps-plugin-azuremaps').OmhMapsPluginAzureMapsModule.setSubscriptionKey(CONFIG.AZURE_MAPS_SUBSCRIPTION_KEY);
}

const DEFAULT_ZOOM = 15;
const GREEN_RGB_INT = utils.colorStrToInt(colors.green);
const TARGET_RGB_INT = utils.colorStrToInt(colors.blue300);

function MapView({style, userLocation: cachedUserLocation, initialState, waypoints, directionCoordinates, onMapReady}: ComponentProps & MapViewOnyxProps) {
    const mapRef = useRef<OmhMapViewRef | null>(null);
    const [currentPosition, setCurrentPosition] = useState<OmhCoordinate | null>(() => {
        const coord = {
            longitude: (cachedUserLocation as any)?.[0] ?? initialState?.location?.[0],
            latitude: (cachedUserLocation as any)?.[1] ?? initialState?.location?.[1],
        };

        return coord.longitude === null ? null : coord;
    });
    const [zoom, setZoom] = useState(initialState?.zoom ?? DEFAULT_ZOOM);
    const [mapProvider, setMapProvider] = useState<OmhMapProvider>(Platform.OS === 'ios' ? OmhMapsAppleMapsIOSProvider : OmhMapsGoogleMapsProvider);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapWidth, setMapWidth] = useState(100);

    const lastUpdatedPositionRef = useRef<OmhCoordinate | null>(null);

    useFocusEffect(
        useCallback(() => {
            if (!mapLoaded || _.isEqual(lastUpdatedPositionRef.current, currentPosition)) {
                return;
            }

            if (currentPosition) {
                mapRef.current?.setCameraCoordinate(currentPosition, zoom);
            } else {
                OmhMapsLocationModule.getCurrentLocation().then((currentLocation) => {
                    mapRef.current?.setCameraCoordinate(currentLocation, zoom);
                    setCurrentPosition(currentLocation);

                    lastUpdatedPositionRef.current = currentLocation;
                });
            }
            // apart from the required dependencies, we also want to update the position when the map is re-loaded
            // with a new provider selected
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [zoom, mapLoaded, currentPosition, mapProvider]),
    );

    useEffect(() => {
        if (!waypoints || waypoints.length === 0 || !mapLoaded) {
            return;
        }
        if (waypoints.length === 1) {
            setCurrentPosition({
                longitude: waypoints[0].coordinate[0],
                latitude: waypoints[0].coordinate[1],
            });
            setZoom(DEFAULT_ZOOM);
        } else {
            const {southWest, northEast} = utils.getBounds(
                waypoints.map((waypoint) => waypoint.coordinate),
                directionCoordinates,
            );

            const meanLongitude = (southWest[0] + northEast[0]) / 2;
            const meanLatitude = (southWest[1] + northEast[1]) / 2;

            setCurrentPosition({
                longitude: meanLongitude,
                latitude: meanLatitude,
            });

            setZoom(utils.headingToFit(northEast[0], southWest[0], mapWidth));
        }
    }, [waypoints, directionCoordinates, mapLoaded, mapWidth]);

    const MAP_PROVIDERS = useMemo(
        () =>
            Platform.OS === 'android'
                ? [OmhMapsGoogleMapsProvider, OmhMapsOpenStreetMapProvider, OmhMapsMapboxProvider, OmhMapsAzureMapsProvider]
                : [OmhMapsGoogleMapsIOSProvider, OmhMapsAppleMapsIOSProvider],
        [],
    );

    return (
        <View style={{paddingHorizontal: 15, flexDirection: 'column', flex: 1}}>
            <ButtonWithDropdownMenu
                success
                pressOnEnter
                onPress={() => {}}
                onOptionSelected={({value: provider}) => {
                    setMapLoaded(false);

                    OmhMapsModule.initialize({
                        iosProvider: Platform.OS === 'ios' ? provider : OmhMapsAppleMapsIOSProvider,
                        gmsProvider: Platform.OS === 'android' ? provider : OmhMapsGoogleMapsProvider,
                        nonGmsProvider: Platform.OS === 'android' ? provider : OmhMapsOpenStreetMapProvider,
                    });

                    setMapProvider(provider);
                }}
                options={MAP_PROVIDERS.map((provider) => ({
                    text: provider.name,
                    value: provider,
                }))}
                buttonSize={CONST.DROPDOWN_BUTTON_SIZE.LARGE}
                enterKeyEventListenerPriority={1}
            />

            <OmhMapView
                key={mapProvider.name}
                onLayout={({
                    nativeEvent: {
                        layout: {width},
                    },
                }) => {
                    setMapWidth(width);
                }}
                ref={mapRef}
                style={style}
                zoomEnabled
                rotateEnabled={false}
                myLocationEnabled={false}
                onMapLoaded={(providerName) => {
                    onMapReady?.();
                    setMapLoaded(true);
                    setMapProvider(MAP_PROVIDERS.find(({name}) => name === providerName) ?? OmhMapsGoogleMapsProvider);
                }}
            >
                {!!directionCoordinates && (
                    <OmhPolyline
                        points={directionCoordinates.map((waypoint) => ({
                            longitude: waypoint[0],
                            latitude: waypoint[1],
                        }))}
                        color={GREEN_RGB_INT}
                        width={20}
                        jointType="miter"
                    />
                )}

                {waypoints?.map(({coordinate, id}, index, {length}) => {
                    const isStart = index === 0;
                    const isEnd = index === length - 1;
                    const isInBetweenStop = !isStart && !isEnd;

                    return (
                        <OmhMarker
                            key={`waypoint-${id}`}
                            position={{
                                longitude: coordinate[0],
                                latitude: coordinate[1],
                            }}
                            title={`Waypoint #${index + 1}`}
                            snippet={`${isStart ? 'Start of' : isEnd ? 'End of' : 'Stop on'} journey`}
                            backgroundColor={isStart ? GREEN_RGB_INT : isEnd ? TARGET_RGB_INT : undefined}
                            icon={isInBetweenStop ? (stopMarkerIcon as any) : undefined}
                            clickable
                        />
                    );
                })}
            </OmhMapView>
        </View>
    );
}

export default compose(
    withOnyx<ComponentProps, MapViewOnyxProps>({
        userLocation: {
            key: ONYXKEYS.USER_LOCATION,
        },
    }),
    memo,
)(MapView);
