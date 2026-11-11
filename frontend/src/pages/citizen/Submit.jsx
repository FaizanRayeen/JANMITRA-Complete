/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/citizen/Submit.jsx
 * Developer: Faizan Rayeen (Citizen Portal Lead)
 * Day: Day 13 - Citizen Issue Submission Form (Part 3: Leaflet GPS Map Picker)
 * Description: Interactive civic complaint creation form layout.
 *              - Part 1 (Day 11):
 *                1. Page Header: 'Report New Civic Issue' with back button to /citizen.
 *                2. 4 Category Cards (2x2 Grid): PWD (Blue), SWM (Green), PHE (Cyan), ELE (Yellow)
 *                   with blue outline & checkmark.
 *                3. Ward selector: Dropdown [Ward 1 | Ward 2 | Ward 3 | Ward 4] (pre-selected from profile).
 *                4. Description field: Textarea (min 15 chars) with character counter.
 *                5. Landmark input: Optional text field for easy field location.
 *              - Part 2 (Day 12):
 *                1. Live Camera Modal + Photo Picker:
 *                   - Live Webcam / Native Camera with browser permission trigger (navigator.mediaDevices.getUserMedia)
 *                   - Upload from Gallery button (accept='image/*')
 *                   - Max 3 photos allowed with file size validation (< 5MB each).
 *                2. Preview Gallery:
 *                   - Interactive thumbnails with delete (X) badge.
 *                   - Primary photo badge on first photo.
 *                   - Click-to-zoom Lightbox modal.
 *                3. HTML5 Canvas Image Optimization:
 *                   - Real client-side resize to max 1280px maintaining aspect ratio.
 *                   - Clean compression feedback.
 *              - Part 3 (Day 13 Additions):
 *                1. Interactive Leaflet Map Centered at Nagpur (21.1458° N, 79.0882° E)
 *                2. 'Detect My Location' Button (calls navigator.geolocation.getCurrentPosition):
 *                   - Places draggable marker at user's current GPS coordinates.
 *                   - Reverse-geocodes to street address and displays Lat & Lng badges.
 *                3. Manual Pin Drag:
 *                   - User can drag pin or click anywhere on map to adjust exact street location.
 *                4. Accuracy Indicator:
 *                   - Shows GPS accuracy radius in metres with map accuracy circle and precision badges.
 *                5. Standalone exported LocationPicker component inside citizen/Submit.jsx.
 * ==============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// Default Central Coordinates: Nagpur Zero Mile Stone
const NAGPUR_CENTER = {
  lat: 21.1458,
  lng: 79.0882,
  defaultAddress: 'Zero Mile Stone, Wardha Road, Civil Lines, Nagpur, Maharashtra 440001'
};

// Comprehensive Nagpur Locations Database (Colleges, Neighborhoods, Wards, Markets & Transit)
const NAGPUR_LOCATIONS_DATABASE = [
  // 🎓 COLLEGES & UNIVERSITIES
  { name: 'VNIT Nagpur (Visvesvaraya National Institute)', area: 'South Ambazari Road • Ward 1', category: 'College', keywords: ['vnit', 'visvesvaraya', 'engineering', 'ambazari', 'college', 'clg', 'cllg'], lat: 21.1255, lng: 79.0524 },
  { name: 'Shri Ramdeobaba College (RCOEM / RBU)', area: 'Katol Road, Gittikhadan • Ward 4', category: 'College', keywords: ['rcoem', 'ramdeobaba', 'rbc', 'rbu', 'katol road', 'college', 'clg'], lat: 21.1764, lng: 79.0617 },
  { name: 'YCCE College of Engineering', area: 'Hingna Road, Wanadongri', category: 'College', keywords: ['ycce', 'yeshwantrao chavan', 'wanadongri', 'hingna', 'college', 'clg'], lat: 21.0968, lng: 78.9794 },
  { name: 'G.H. Raisoni College of Engineering (GHRCE)', area: 'Digdoh Hills, Hingna', category: 'College', keywords: ['ghrce', 'raisoni', 'g h raisoni', 'digdoh', 'college', 'clg'], lat: 21.0988, lng: 79.0035 },
  { name: 'LIT University (Laxminarayan)', area: 'Amravati Road, Ram Nagar • Ward 2', category: 'College', keywords: ['lit', 'laxminarayan', 'technology', 'amravati road', 'college', 'clg'], lat: 21.1449, lng: 79.0494 },
  { name: 'Government College of Engineering Nagpur (GCOEN)', area: 'MIHAN Sector, South Nagpur', category: 'College', keywords: ['gcoen', 'government engineering', 'mihan', 'college', 'clg'], lat: 21.0436, lng: 79.0432 },
  { name: 'KDK College of Engineering', area: 'Great Nag Road, Nandanvan • Ward 3', category: 'College', keywords: ['kdk', 'k.d.k', 'nandanvan', 'nag road', 'college', 'clg'], lat: 21.1293, lng: 79.1345 },
  { name: 'Anjuman College of Engineering & Technology', area: 'Mangalwari, Sadar • Ward 4', category: 'College', keywords: ['anjuman', 'acet', 'sadar', 'mangalwari', 'college', 'clg'], lat: 21.1643, lng: 79.0792 },
  { name: 'Priyadarshini College of Engineering (PCE)', area: 'CRPF Campus, Hingna Road', category: 'College', keywords: ['pce', 'priyadarshini', 'hingna', 'crpf', 'college', 'clg'], lat: 21.1009, lng: 78.9868 },
  { name: 'St. Vincent Pallotti College of Engineering', area: 'Gavsi Manapur, Wardha Road', category: 'College', keywords: ['pallotti', 'st vincent pallotti', 'wardha road', 'college', 'clg'], lat: 21.0372, lng: 79.0526 },
  { name: 'RTMNU Nagpur University Campus', area: 'Amravati Road, Ravi Nagar • Ward 2', category: 'College', keywords: ['rtmnu', 'nagpur university', 'university campus', 'amravati road'], lat: 21.1492, lng: 79.0445 },
  { name: 'AIIMS Nagpur', area: 'MIHAN, South Nagpur', category: 'College', keywords: ['aiims', 'aiims nagpur', 'medical', 'hospital', 'mihan'], lat: 21.0478, lng: 79.0278 },
  { name: 'IIM Nagpur', area: 'MIHAN, South Nagpur', category: 'College', keywords: ['iim', 'iim nagpur', 'management', 'mihan'], lat: 21.0450, lng: 79.0230 },
  { name: 'Government Medical College & Hospital (GMC)', area: 'Medical Chowk, Hanuman Nagar • Ward 3', category: 'College', keywords: ['gmc', 'medical college', 'medical chowk', 'hospital'], lat: 21.1275, lng: 79.0968 },
  { name: 'Indira Gandhi Govt Medical College (Mayo / IGMC)', area: 'Central Avenue Road, Mominpura', category: 'College', keywords: ['mayo', 'igmc', 'indira gandhi medical', 'mominpura'], lat: 21.1528, lng: 79.0956 },
  { name: 'Hislop College', area: 'Temple Road, Civil Lines • Ward 2', category: 'College', keywords: ['hislop', 'civil lines', 'college', 'clg'], lat: 21.1506, lng: 79.0682 },
  { name: 'C.P. & Berar College', area: 'Tulsibagh, Mahal • Ward 3', category: 'College', keywords: ['cp berar', 'c.p. & berar', 'mahal', 'college', 'clg'], lat: 21.1402, lng: 79.1098 },
  { name: 'Dharampeth Science College', area: 'Ambazari Road, Dharampeth • Ward 2', category: 'College', keywords: ['dharampeth science', 'dharampeth college', 'science college'], lat: 21.1342, lng: 79.0565 },
  { name: 'Dr. Ambedkar College', area: 'Deekshabhoomi, Laxmi Nagar • Ward 1', category: 'College', keywords: ['ambedkar college', 'deekshabhoomi college'], lat: 21.1287, lng: 79.0668 },
  { name: 'LAD College for Women', area: 'Shankar Nagar Square • Ward 1', category: 'College', keywords: ['lad', 'lad college', 'shankar nagar'], lat: 21.1378, lng: 79.0588 },
  { name: 'Shivaji Science College', area: 'Congress Nagar, Dhantoli • Ward 1', category: 'College', keywords: ['shivaji science', 'congress nagar'], lat: 21.1305, lng: 79.0792 },

  // 🏡 NEIGHBORHOODS, COLONIES & WARDS
  { name: 'Shanti Nagar', area: 'Itwari / Ward 4 • North-East Nagpur', category: 'Colony', keywords: ['shanti nagar', 'shantinagar', 'uphc', 'itwari'], lat: 21.1591, lng: 79.1263 },
  { name: 'Itwari Market', area: 'Kirana Oli, Sarafa Bazar • Ward 4', category: 'Market', keywords: ['itwari', 'itwari market', 'sarafa', 'kirana oli', 'marwari chowk'], lat: 21.1542, lng: 79.1175 },
  { name: 'Mangalwari Zone', area: 'Mangalwari, Jaripatka • Ward 4', category: 'Civic', keywords: ['mangalwari', 'ward 4', 'koradi road'], lat: 21.1685, lng: 79.0850 },
  { name: 'Sadar Main Road', area: 'Residency Road, Sadar • Ward 4', category: 'Market', keywords: ['sadar', 'residency road', 'sadar bazar', 'mount road'], lat: 21.1610, lng: 79.0790 },
  { name: 'Jaripatka', area: 'Sindhi Colony, Ring Road • Ward 4', category: 'Colony', keywords: ['jaripatka', 'sindhi colony', 'mecosabagh'], lat: 21.1820, lng: 79.0915 },
  { name: 'Dharampeth', area: 'West High Court Road • Ward 2', category: 'Colony', keywords: ['dharampeth', 'whc road', 'gokulpeth', 'ward 2'], lat: 21.1442, lng: 79.0620 },
  { name: 'Gokulpeth Market', area: 'WHC Road, Dharampeth • Ward 2', category: 'Market', keywords: ['gokulpeth', 'gokulpeth market', 'bazar'], lat: 21.1398, lng: 79.0610 },
  { name: 'Ram Nagar', area: 'Telankhedi Road • Ward 2', category: 'Colony', keywords: ['ram nagar', 'ramnagar', 'hill road'], lat: 21.1472, lng: 79.0535 },
  { name: 'Civil Lines', area: 'High Court, JMC, Zero Mile • Ward 2', category: 'Civic', keywords: ['civil lines', 'high court', 'collector office', 'vidhan bhavan'], lat: 21.1550, lng: 79.0720 },
  { name: 'Laxmi Nagar', area: 'RPTS Road, Water Tank • Ward 1', category: 'Colony', keywords: ['laxmi nagar', 'laxminagar', 'rpts', 'ward 1'], lat: 21.1215, lng: 79.0670 },
  { name: 'Bajaj Nagar', area: 'Abhyankar Nagar Road • Ward 1', category: 'Colony', keywords: ['bajaj nagar', 'bajajnagar', 'abhyankar nagar'], lat: 21.1285, lng: 79.0615 },
  { name: 'Pratap Nagar', area: 'Ring Road • Ward 1', category: 'Colony', keywords: ['pratap nagar', 'pratapnagar', 'ring road'], lat: 21.1152, lng: 79.0558 },
  { name: 'Trimurti Nagar', area: 'Bhamti, Ring Road • Ward 1', category: 'Colony', keywords: ['trimurti nagar', 'trimurtinagar', 'bhamti'], lat: 21.1120, lng: 79.0440 },
  { name: 'Khamla', area: 'Khamla Market, Pandey Layout • Ward 1', category: 'Colony', keywords: ['khamla', 'khamla square', 'pandey layout'], lat: 21.1102, lng: 79.0622 },
  { name: 'Hanuman Nagar', area: 'Medical Square • Ward 3', category: 'Colony', keywords: ['hanuman nagar', 'hanumannagar', 'medical chowk', 'ward 3'], lat: 21.1280, lng: 79.0965 },
  { name: 'Reshimbagh', area: 'Suresh Bhat Sabhagruh • Ward 3', category: 'Colony', keywords: ['reshimbagh', 'suresh bhat', 'ground', 'smruti mandir'], lat: 21.1245, lng: 79.1028 },
  { name: 'Sakkardara', area: 'Sakkardara Lake, Ayurvedic Layout • Ward 3', category: 'Colony', keywords: ['sakkardara', 'sakkardara chowk', 'lake'], lat: 21.1225, lng: 79.1120 },
  { name: 'Nandanvan', area: 'KDK College Road, Hasanbagh • Ward 3', category: 'Colony', keywords: ['nandanvan', 'hasanbagh', 'nandanvan colony'], lat: 21.1310, lng: 79.1285 },
  { name: 'Manewada', area: 'Manewada Square, Ring Road • Ward 3', category: 'Colony', keywords: ['manewada', 'manewada square', 'besa square'], lat: 21.1042, lng: 79.0990 },
  { name: 'Besa', area: 'Besa-Pipla Road, South Nagpur', category: 'Colony', keywords: ['besa', 'pipla', 'besa square', 'ghogli'], lat: 21.0855, lng: 79.1040 },
  { name: 'Ayodhya Nagar', area: 'Bidipeth, Manewada Road • Ward 3', category: 'Colony', keywords: ['ayodhya nagar', 'ayodhyanagar', 'bidipeth'], lat: 21.1158, lng: 79.1090 },
  { name: 'Dighori', area: 'Umred Road, Kharbi • Ward 3', category: 'Colony', keywords: ['dighori', 'kharbi', 'umred road'], lat: 21.1108, lng: 79.1350 },
  { name: 'Mahal', area: 'Tilak Putla, Badkas Chowk', category: 'Market', keywords: ['mahal', 'badkas chowk', 'tilak putla', 'kalyaneswar'], lat: 21.1435, lng: 79.1082 },
  { name: 'Gandhibagh', area: 'Central Avenue, Teen Nal Chowk', category: 'Market', keywords: ['gandhibagh', 'gandhi bagh', 'central avenue', 'cloth market'], lat: 21.1502, lng: 79.1055 },
  { name: 'Sitabuldi', area: 'Munje Square, Main Market', category: 'Market', keywords: ['sitabuldi', 'bardi', 'variety square', 'munje square', 'buldi'], lat: 21.1466, lng: 79.0827 },
  { name: 'Dhantoli', area: 'Mehadia Square, Congress Nagar', category: 'Colony', keywords: ['dhantoli', 'mehadia square', 'hospital zone'], lat: 21.1355, lng: 79.0780 },
  { name: 'Manish Nagar', area: 'Beltarodi Road, Wardha Road', category: 'Colony', keywords: ['manish nagar', 'manishnagar', 'railway crossing'], lat: 21.0920, lng: 79.0745 },
  { name: 'Narendra Nagar', area: 'Ring Road, Suyog Nagar', category: 'Colony', keywords: ['narendra nagar', 'narendranagar', 'ring road bridge'], lat: 21.1055, lng: 79.0772 },
  { name: 'Chhatrapati Square', area: 'Wardha Road, Ring Road Junction', category: 'Civic', keywords: ['chhatrapati square', 'chhatrapati nagar', 'wardha road'], lat: 21.1115, lng: 79.0675 },
  { name: 'Mankapur', area: 'Sports Complex, Koradi Road • Ward 4', category: 'Civic', keywords: ['mankapur', 'sports complex', 'stadium', 'koradi road'], lat: 21.1895, lng: 79.0782 },
  { name: 'Koradi', area: 'Mahalaxmi Temple, Power Plant', category: 'Landmark', keywords: ['koradi', 'koradi temple', 'mahalaxmi'], lat: 21.2425, lng: 79.0965 },
  { name: 'Kamptee Road', area: 'Automotive Square, Uppalwadi', category: 'Transit', keywords: ['kamptee road', 'automotive square', 'uppalwadi'], lat: 21.1960, lng: 79.1120 },
  { name: 'Pardi', area: 'HB Town, Bhandara Road', category: 'Colony', keywords: ['pardi', 'hb town', 'bhandara road', 'kapsi'], lat: 21.1495, lng: 79.1550 },
  { name: 'Wadi', area: 'MIDC Hingna Road, Amravati Road', category: 'Colony', keywords: ['wadi', 'wadi naka', 'midc wadi'], lat: 21.1495, lng: 78.9890 },
  { name: 'MIHAN', area: 'SEZ, Multi-modal Hub, Airport Zone', category: 'Civic', keywords: ['mihan', 'sez', 'infotech park', 'tcs mihan', 'infosys'], lat: 21.0350, lng: 79.0320 },

  // 🏛️ LANDMARKS & TRANSIT
  { name: 'Zero Mile Stone Nagpur', area: 'Civil Lines, Nagpur Central', category: 'Civic', keywords: ['zero mile', 'zero mile stone', 'monument', 'center of india'], lat: 21.1458, lng: 79.0882 },
  { name: 'Deekshabhoomi', area: 'South Ambazari Road, Shraddhanand Peth', category: 'Landmark', keywords: ['deekshabhoomi', 'stupa', 'buddhist monument'], lat: 21.1275, lng: 79.0665 },
  { name: 'Futala Lake', area: 'Telankhedi, Vayusena Nagar', category: 'Landmark', keywords: ['futala', 'futala lake', 'fountain', 'telankhedi'], lat: 21.1545, lng: 79.0435 },
  { name: 'Ambazari Lake & Garden', area: 'Subhash Nagar, Hingna Road', category: 'Landmark', keywords: ['ambazari', 'ambazari lake', 'garden'], lat: 21.1290, lng: 79.0420 },
  { name: 'Nagpur Central Railway Station', area: 'Station Road, Sitabuldi', category: 'Transit', keywords: ['railway station', 'nagpur junction', 'train station', 'central railway'], lat: 21.1524, lng: 79.0888 },
  { name: 'Dr. Babasaheb Ambedkar Airport (Nagpur Airport)', area: 'Sonegaon, Wardha Road', category: 'Transit', keywords: ['airport', 'nagpur airport', 'flight', 'sonegaon'], lat: 21.0922, lng: 79.0472 },
  { name: 'JMC Head Office (Municipal Corporation)', area: 'Mahanagar Palika Marg, Civil Lines', category: 'Civic', keywords: ['jmc', 'nmc', 'municipal corporation', 'mahanagarpalika', 'head office'], lat: 21.1517, lng: 79.0768 },
];

/**
 * Parse Photon API GeoJSON features into standardized place objects
 */
const parsePhotonFeatures = (features) => {
  return features.map((f) => {
    const props = f.properties || {};
    const coords = f.geometry?.coordinates || [];
    const lng = coords[0];
    const lat = coords[1];

    const name = props.name || props.street || props.district || props.city || 'Nagpur Location';
    
    const areaParts = [
      props.street,
      props.district,
      props.city || (props.state === 'Maharashtra' ? 'Nagpur' : props.state)
    ].filter(Boolean);
    const area = areaParts.length > 0 ? areaParts.join(', ') : 'Nagpur, Maharashtra';

    const osmVal = ((props.osm_value || '') + ' ' + (props.osm_key || '')).toLowerCase();
    
    let category = 'Location';
    let icon = '📍';

    if (osmVal.includes('hospital') || osmVal.includes('clinic') || osmVal.includes('pharmacy')) {
      category = 'Health';
      icon = '🏥';
    } else if (osmVal.includes('college') || osmVal.includes('university') || osmVal.includes('school')) {
      category = 'Education';
      icon = '🎓';
    } else if (osmVal.includes('worship') || osmVal.includes('temple') || osmVal.includes('mosque') || osmVal.includes('church')) {
      category = 'Temple / Worship';
      icon = '🛕';
    } else if (osmVal.includes('bakery') || osmVal.includes('restaurant') || osmVal.includes('cafe') || osmVal.includes('food')) {
      category = 'Food & Dining';
      icon = '🍽️';
    } else if (osmVal.includes('shop') || osmVal.includes('supermarket') || osmVal.includes('mall') || osmVal.includes('commercial')) {
      category = 'Store / Mall';
      icon = '🛒';
    } else if (osmVal.includes('bank') || osmVal.includes('atm')) {
      category = 'Bank / ATM';
      icon = '🏦';
    } else if (osmVal.includes('station') || osmVal.includes('subway') || osmVal.includes('halt')) {
      category = 'Transit';
      icon = '🚉';
    } else if (osmVal.includes('hotel') || osmVal.includes('guest_house')) {
      category = 'Hotel / Stay';
      icon = '🏨';
    } else if (osmVal.includes('residential') || osmVal.includes('suburb') || osmVal.includes('neighbourhood')) {
      category = 'Colony / Area';
      icon = '🏡';
    } else if (osmVal.includes('road') || osmVal.includes('highway') || osmVal.includes('square')) {
      category = 'Road / Square';
      icon = '🛣️';
    }

    return { name, area, lat, lng, category, icon };
  });
};

/**
 * Parse OpenStreetMap Nominatim results into standardized place objects
 */
const parseNominatimResults = (results) => {
  return results.map((item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const addr = item.address || {};
    
    const name = item.name || addr.amenity || addr.shop || addr.building || item.display_name.split(',')[0];
    const areaParts = [
      addr.road || addr.street,
      addr.suburb || addr.neighbourhood || addr.quarter,
      addr.city || 'Nagpur'
    ].filter(Boolean);
    const area = areaParts.length > 0 ? areaParts.join(', ') : item.display_name;

    const type = ((item.type || '') + ' ' + (item.class || '')).toLowerCase();
    let category = 'Location';
    let icon = '📍';

    if (type.includes('hospital') || type.includes('clinic')) { category = 'Health'; icon = '🏥'; }
    else if (type.includes('college') || type.includes('school') || type.includes('university')) { category = 'Education'; icon = '🎓'; }
    else if (type.includes('worship') || type.includes('temple')) { category = 'Temple / Worship'; icon = '🛕'; }
    else if (type.includes('restaurant') || type.includes('food') || type.includes('bakery') || type.includes('cafe')) { category = 'Food & Dining'; icon = '🍽️'; }
    else if (type.includes('shop') || type.includes('mall') || type.includes('supermarket')) { category = 'Store / Mall'; icon = '🛒'; }
    else if (type.includes('station')) { category = 'Transit'; icon = '🚉'; }
    else if (type.includes('hotel')) { category = 'Hotel'; icon = '🏨'; }
    else if (type.includes('residential') || type.includes('suburb')) { category = 'Colony / Area'; icon = '🏡'; }

    return { name, area, lat, lng, category, icon };
  });
};

/**
 * Sort results prioritizing locations closest to Nagpur Zero Mile
 */
const filterAndSortNagpur = (items) => {
  return items.sort((a, b) => {
    const distA = Math.hypot((a.lat - NAGPUR_CENTER.lat) * 111, (a.lng - NAGPUR_CENTER.lng) * 103);
    const distB = Math.hypot((b.lat - NAGPUR_CENTER.lat) * 111, (b.lng - NAGPUR_CENTER.lng) * 103);
    return distA - distB;
  });
};

// 4 Category Cards with department-specific colors & details
const CATEGORIES = [
  {
    id: 'PWD',
    code: 'PWD',
    deptId: 1,
    title: 'Roads & Infrastructure',
    department: 'Public Works Department (PWD)',
    colorName: 'Blue',
    colorClasses: {
      badge: 'bg-blue-600 text-white',
      badgeLight: 'bg-blue-100 text-blue-800 border-blue-200',
      iconBg: 'bg-blue-50 text-blue-600',
      tagColor: 'text-blue-600',
    },
    examples: 'Potholes, broken asphalt, damaged pavements & open manholes',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 17h16M4 21h16" />
      </svg>
    )
  },
  {
    id: 'SWM',
    code: 'SWM',
    deptId: 2,
    title: 'Garbage & Waste',
    department: 'Solid Waste Management (SWM)',
    colorName: 'Green',
    colorClasses: {
      badge: 'bg-emerald-600 text-white',
      badgeLight: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-600',
      tagColor: 'text-emerald-600',
    },
    examples: 'Overflowing bins, uncollected trash & illegal open dumping',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    )
  },
  {
    id: 'PHE',
    code: 'PHE',
    deptId: 3,
    title: 'Water & Drainage',
    department: 'Public Health Engineering (PHE)',
    colorName: 'Cyan',
    colorClasses: {
      badge: 'bg-cyan-600 text-white',
      badgeLight: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      iconBg: 'bg-cyan-50 text-cyan-600',
      tagColor: 'text-cyan-600',
    },
    examples: 'Pipeline bursts, contaminated water, overflowing drains & sewage leaks',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    )
  },
  {
    id: 'ELE',
    code: 'ELE',
    deptId: 4,
    title: 'Street Lighting',
    department: 'Electrical Department',
    colorName: 'Yellow',
    colorClasses: {
      badge: 'bg-amber-500 text-white',
      badgeLight: 'bg-amber-100 text-amber-900 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-600',
      tagColor: 'text-amber-600',
    },
    examples: 'Non-functional street lamps, flickering lights & dangerous exposed wires',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )
  }
];

// Municipal Corporation Wards [Ward 1 | Ward 2 | Ward 3 | Ward 4]
const WARDS = [
  { id: 'Ward 1', name: 'Ward 1', area: 'Laxmi Nagar / West Nagpur' },
  { id: 'Ward 2', name: 'Ward 2', area: 'Dharampeth / Central Nagpur' },
  { id: 'Ward 3', name: 'Ward 3', area: 'Hanuman Nagar / South Nagpur' },
  { id: 'Ward 4', name: 'Ward 4', area: 'Mangalwari / North Nagpur' },
];

/**
 * Format bytes to readable format (KB, MB)
 */
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Custom Leaflet Map Pin DivIcon
 * Immune to Vite asset bundling paths; supports GPS vs Manual styling.
 */
const createCustomPinIcon = (isGps = false) => {
  const pinColor = isGps ? '#10B981' : '#1A56DB';
  const pulseHtml = isGps
    ? `<span style="position: absolute; top: -6px; right: -6px; width: 12px; height: 12px; background: #10B981; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px #10B981; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
    : '';

  return L.divIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div style="position: relative; width: 36px; height: 42px; transform: translate(-50%, -100%); cursor: grab;">
        <div style="
          width: 36px;
          height: 36px;
          background: ${pinColor};
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 6px 14px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="transform: rotate(45deg); font-size: 14px; color: white;">📍</span>
        </div>
        ${pulseHtml}
        <div style="
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 10px;
          height: 4px;
          background: rgba(0,0,0,0.35);
          border-radius: 50%;
          filter: blur(1px);
        "></div>
      </div>
    `,
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -42]
  });
};

/**
 * Reverse Geocode Coordinates via OpenStreetMap Nominatim with Intelligent Civic Parsing
 * Extracts exact building/shop/establishment name, street, locality, colony/ward, and city with postcode.
 * Gracefully falls back to nearest known Nagpur landmark or formatted coordinates if network fails.
 */
const fetchReverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'JanmitraNagpurCivic/1.0'
        }
      }
    );
    if (!response.ok) throw new Error('Geocoding request failed');
    const data = await response.json();
    const addr = data.address || {};

    // 1. Specific Establishment / Building / Shop / Health / Education / Landmark
    const placeName = (
      data.name ||
      addr.amenity ||
      addr.shop ||
      addr.healthcare ||
      addr.hospital ||
      addr.clinic ||
      addr.pharmacy ||
      addr.school ||
      addr.college ||
      addr.university ||
      addr.commercial ||
      addr.office ||
      addr.building ||
      addr.place_of_worship ||
      addr.tourism ||
      addr.leisure ||
      addr.bank ||
      addr.restaurant
    );

    // 2. Street / Road / House Number
    const houseNumber = addr.house_number || addr.housenumber || '';
    const roadName = addr.road || addr.street || addr.pedestrian || addr.residential || addr.footway || addr.path || addr.highway || '';
    const streetLine = [houseNumber, roadName].filter(Boolean).join(' ');

    // 3. Colony / Neighbourhood
    const colony = addr.neighbourhood || addr.subdivision || addr.colony || addr.residential_area || '';

    // 4. Suburb / Ward / Zone
    const suburb = addr.suburb || addr.quarter || addr.city_district || addr.ward || '';

    // 5. City, State, Postcode
    const city = addr.city || addr.town || addr.municipality || addr.village || 'Nagpur';
    const state = addr.state || 'Maharashtra';
    const postcode = addr.postcode ? addr.postcode.trim() : '';

    // Deduplicate and assemble clean Indian civic address
    const segments = [];
    const seen = new Set();
    const addSegment = (val) => {
      if (!val) return;
      const clean = String(val).trim();
      if (!clean) return;
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        segments.push(clean);
      }
    };

    addSegment(placeName);
    addSegment(streetLine);
    addSegment(colony);
    addSegment(suburb);
    addSegment(city);
    addSegment(state);

    let formatted = segments.join(', ');
    if (postcode && !formatted.includes(postcode)) {
      formatted += ` - ${postcode}`;
    }

    if (segments.length >= 2) {
      return formatted;
    }

    if (data.display_name) {
      return data.display_name.replace(/,\s*India$/i, '').trim();
    }

    return `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E, Nagpur, Maharashtra`;
  } catch (err) {
    // Intelligent Offline / Fallback: Find nearest known landmark in Nagpur
    try {
      if (Array.isArray(NAGPUR_LOCATIONS_DATABASE) && NAGPUR_LOCATIONS_DATABASE.length > 0) {
        let nearest = null;
        let minDist = Infinity;
        for (const item of NAGPUR_LOCATIONS_DATABASE) {
          const dLat = (item.lat - lat) * 111;
          const dLng = (item.lng - lng) * 103;
          const dist = Math.hypot(dLat, dLng);
          if (dist < minDist) {
            minDist = dist;
            nearest = item;
          }
        }
        if (nearest && minDist < 1.5) {
          return `Near ${nearest.name}, ${nearest.area}, Nagpur, Maharashtra`;
        }
      }
    } catch (_) {}

    return `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E, Nagpur, Maharashtra`;
  }
};

/**
 * Canvas Image Compression Utility
 * Resizes images client-side to max 1280px maintaining aspect ratio
 */
const compressImageWithCanvas = (file, maxDimension = 1280, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Invalid file type: Please select an image file'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Downscale proportionally if larger than maxDimension (1280px)
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas compression failed to generate image blob'));
              return;
            }

            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const originalSize = file.size;
            const compressedSize = blob.size;
            const savedPct = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

            resolve({
              id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              originalFile: file,
              compressedBlob: blob,
              dataUrl,
              originalSize,
              compressedSize,
              savedPct,
              width,
              height
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image in canvas'));
      img.src = event.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read file from storage'));
    reader.readAsDataURL(file);
  });
};

/**
 * ==============================================================================
 * LocationPicker Component
 * Interactive Leaflet GPS map with Nagpur centering, geolocation detection,
 * draggable pin, accuracy radius circles, and reverse geocoding badges.
 * ==============================================================================
 */
const TILE_LAYERS = {
  street: {
    id: 'street',
    label: 'Street View',
    icon: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite View',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  }
};

const NMC_WARDS = [
  { id: 'Ward 4', name: 'Ward 4 - Mangalwari / North-East Nagpur', area: 'Mangalwari, Itwari, Shantinagar, Jaripatka, Sadar, Koradi Rd', lat: 21.1685, lng: 79.0850 },
  { id: 'Ward 2', name: 'Ward 2 - Dharampeth / West Nagpur', area: 'Dharampeth, Gokulpeth, Ram Nagar, Shivaji Nagar', lat: 21.1442, lng: 79.0620 },
  { id: 'Ward 1', name: 'Ward 1 - Laxmi Nagar / South-West Nagpur', area: 'Laxmi Nagar, Bajaj Nagar, Pratap Nagar, Trimurti Nagar', lat: 21.1215, lng: 79.0670 },
  { id: 'Ward 3', name: 'Ward 3 - Hanuman Nagar / South-East Nagpur', area: 'Hanuman Nagar, Medical Chowk, Reshimbagh, Sakkardara', lat: 21.1280, lng: 79.0965 },
];

const getNearestWard = (lat, lng) => {
  if (!lat || !lng) return NMC_WARDS[0];
  let closest = NMC_WARDS[0];
  let minDistance = Infinity;

  NMC_WARDS.forEach((w) => {
    const d = Math.hypot(lat - w.lat, lng - w.lng);
    if (d < minDistance) {
      minDistance = d;
      closest = w;
    }
  });

  return closest;
};

export const LocationPicker = ({
  location,
  onLocationChange,
  selectedWard,
  onSelectWard,
  onSetLandmark
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const circleInstanceRef = useRef(null);
  const layerInstanceRef = useRef(null);
  const watchIdRef = useRef(null);
  const addressCacheRef = useRef(new Map());

  const [activeLayer, setActiveLayer] = useState('street');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [copiedLandmark, setCopiedLandmark] = useState(false);

  const searchContainerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Close suggestions dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Quick-Pick Popular Nagpur Civic Hubs
  const QUICK_LOCATIONS = [
    { label: 'Mangalwari (Ward 4)', lat: 21.1685, lng: 79.0850 },
    { label: 'Dharampeth (Ward 2)', lat: 21.1442, lng: 79.0620 },
    { label: 'Laxmi Nagar (Ward 1)', lat: 21.1215, lng: 79.0670 },
    { label: 'Hanuman Nagar (Ward 3)', lat: 21.1280, lng: 79.0965 },
    { label: 'Sitabuldi Junction', lat: 21.1466, lng: 79.0827 },
    { label: 'Sadar Main Road', lat: 21.1610, lng: 79.0790 },
    { label: 'Civil Lines', lat: 21.1550, lng: 79.0720 },
    { label: 'Medical Chowk', lat: 21.1280, lng: 79.0965 },
  ];

  // Calculate detected ward jurisdiction based on current coordinates
  const detectedWard = getNearestWard(location?.lat || NAGPUR_CENTER.lat, location?.lng || NAGPUR_CENTER.lng);
  const isWardMatching = selectedWard ? String(selectedWard).toLowerCase().includes(detectedWard.id.toLowerCase()) : true;

  /**
   * Internal coordinate & address updater with high-resolution caching (~1m grid)
   * Supports direct address assignment (e.g. from search suggestions / quick landmarks)
   * and automatically synchronizes NMC Ward jurisdiction with Section 2.
   */
  const handleLocationUpdate = async (newLat, newLng, newAccuracy = null, isGps = false, directAddress = null) => {
    // 5 decimals gives ~1.1 meter resolution for fine-grained street pin movement
    const cacheKey = `${newLat.toFixed(5)}_${newLng.toFixed(5)}`;
    let resolvedAddress = directAddress || addressCacheRef.current.get(cacheKey);

    if (!resolvedAddress) {
      setIsGeocoding(true);
      resolvedAddress = await fetchReverseGeocode(newLat, newLng);
      setIsGeocoding(false);
      if (resolvedAddress) {
        addressCacheRef.current.set(cacheKey, resolvedAddress);
      }
    } else if (directAddress) {
      addressCacheRef.current.set(cacheKey, directAddress);
    }

    onLocationChange({
      lat: Number(newLat.toFixed(6)),
      lng: Number(newLng.toFixed(6)),
      address: resolvedAddress || NAGPUR_CENTER.defaultAddress,
      accuracy: newAccuracy,
      isGpsDetected: isGps,
      timestamp: new Date().toISOString()
    });

    // Auto-sync Section 2's selectedWard with the detected NMC Ward
    const detected = getNearestWard(newLat, newLng);
    if (detected && detected.id && onSelectWard) {
      onSelectWard(detected.id);
    }
  };

  /**
   * Live Google Maps-Style Geocoding Search (Photon API + OSM Nominatim Fallback)
   * Searches any shop, bakery, clinic, temple, apartment, square, school or road in Nagpur.
   */
  const fetchLiveSuggestions = async (queryText) => {
    const q = queryText.trim();
    if (q.length < 2) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoadingSuggestions(true);

    try {
      // 1. Live Photon search with Nagpur center coordinates bias (lat: 21.1458, lon: 79.0882)
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=21.1458&lon=79.0882&limit=10`;
      const res = await fetch(photonUrl, { signal });
      if (res.ok) {
        const data = await res.json();
        const features = data.features || [];
        if (features.length > 0) {
          let parsed = parsePhotonFeatures(features);
          // Prioritize closest to Nagpur
          parsed = filterAndSortNagpur(parsed).slice(0, 8);
          setSuggestions(parsed);
          setIsDropdownOpen(true);
          setIsLoadingSuggestions(false);
          return;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('[LiveSearch] Photon query fallback:', err);
    }

    // 2. Fallback to OpenStreetMap Nominatim with Nagpur suffix
    try {
      const nomQuery = q.toLowerCase().includes('nagpur') ? q : `${q}, Nagpur`;
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(nomQuery)}&limit=8&addressdetails=1`;
      const res = await fetch(nomUrl, { signal, headers: { 'Accept-Language': 'en' } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const parsed = parseNominatimResults(data);
          setSuggestions(parsed.slice(0, 8));
          setIsDropdownOpen(true);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('[LiveSearch] Nominatim query error:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  /**
   * Input Change Handler: Instant local match + Debounced live API fetch
   */
  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    const q = val.trim().toLowerCase();

    if (!q) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      setIsLoadingSuggestions(false);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return;
    }

    // Immediate local match for 0ms visual feedback
    const localMatches = NAGPUR_LOCATIONS_DATABASE.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.area.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
    ).slice(0, 5);

    if (localMatches.length > 0) {
      setSuggestions(localMatches);
      setIsDropdownOpen(true);
    }

    // Debounce live global search by 200ms
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchLiveSuggestions(val);
    }, 200);
  };

  /**
   * User clicks any suggestion from the live dropdown
   */
  const handleSelectSuggestion = async (item) => {
    const directAddr = item.area ? `${item.name}, ${item.area}` : item.name;
    setSearchQuery(item.name);
    setIsDropdownOpen(false);
    setGpsError(null);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([item.lat, item.lng], 19, { duration: 1.0 });
    }

    await handleLocationUpdate(item.lat, item.lng, 10, true, directAddr);
  };

  /**
   * Search Submission (Enter key or Find Location button)
   */
  const handleSearchLocation = async (e) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearchingLocation(true);
    setGpsError(null);
    setIsDropdownOpen(false);

    // If suggestions are currently available, choose the top match
    if (suggestions.length > 0) {
      await handleSelectSuggestion(suggestions[0]);
      setIsSearchingLocation(false);
      return;
    }

    // Otherwise, perform immediate live search
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=21.1458&lon=79.0882&limit=5`;
      const res = await fetch(photonUrl);
      if (res.ok) {
        const data = await res.json();
        const features = data.features || [];
        if (features.length > 0) {
          const parsed = filterAndSortNagpur(parsePhotonFeatures(features));
          if (parsed.length > 0) {
            await handleSelectSuggestion(parsed[0]);
            setIsSearchingLocation(false);
            return;
          }
        }
      }
    } catch (_) {}

    // Fallback to Nominatim
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ', Nagpur')}&limit=5&addressdetails=1`;
      const res = await fetch(nomUrl, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const parsed = parseNominatimResults(data);
        await handleSelectSuggestion(parsed[0]);
        setIsSearchingLocation(false);
        return;
      }
    } catch (_) {}

    setGpsError(`Could not find "${q}". Please check the spelling or drag the map pin.`);
    setIsSearchingLocation(false);
  };

  /**
   * Quick-jump to landmark chip
   */
  const handleSelectQuickLocation = async (loc) => {
    setGpsError(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lng], 18, { duration: 1.0 });
    }
    const directAddr = `${loc.label}, Nagpur, Maharashtra`;
    await handleLocationUpdate(loc.lat, loc.lng, 15, true, directAddr);
    setSearchQuery('');
  };

  /**
   * 2. Initialize Leaflet Map centered at Nagpur with Layer Switcher
   */
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = location?.lat || NAGPUR_CENTER.lat;
    const initialLng = location?.lng || NAGPUR_CENTER.lng;

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false
    });

    // Custom Zoom Control at Bottom Right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial Tile Layer
    const currentLayerConfig = TILE_LAYERS[activeLayer];
    const initialLayer = L.tileLayer(currentLayerConfig.url, {
      attribution: currentLayerConfig.attribution,
      maxZoom: currentLayerConfig.maxZoom
    }).addTo(map);
    layerInstanceRef.current = initialLayer;

    // Initial Draggable Marker
    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: createCustomPinIcon(location?.isGpsDetected || false)
    }).addTo(map);

    marker.bindPopup(
      `<div style="font-size: 12px; font-family: sans-serif;">
        <strong>Civic Issue Location</strong><br/>
        Drag marker to pinpoint exact street spot.
      </div>`
    );

    // Marker Drag Event
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      handleLocationUpdate(pos.lat, pos.lng, null, false);
    });

    // Map Click Event (Reposition Marker)
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      handleLocationUpdate(lat, lng, null, false);
    });

    mapInstanceRef.current = map;
    markerInstanceRef.current = marker;

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      if (watchIdRef.current !== null) {
        try { navigator.geolocation.clearWatch(watchIdRef.current); } catch (_) {}
      }
      map.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
      circleInstanceRef.current = null;
      layerInstanceRef.current = null;
    };
  }, []);

  /**
   * 3. Synchronize Marker Position & Accuracy Circle when props change
   */
  useEffect(() => {
    if (!mapInstanceRef.current || !markerInstanceRef.current) return;

    const lat = location?.lat || NAGPUR_CENTER.lat;
    const lng = location?.lng || NAGPUR_CENTER.lng;

    markerInstanceRef.current.setLatLng([lat, lng]);
    markerInstanceRef.current.setIcon(createCustomPinIcon(location?.isGpsDetected || false));

    // Handle Accuracy Circle
    if (location?.accuracy && location.accuracy > 0) {
      if (circleInstanceRef.current) {
        circleInstanceRef.current.setLatLng([lat, lng]);
        circleInstanceRef.current.setRadius(location.accuracy);
      } else {
        circleInstanceRef.current = L.circle([lat, lng], {
          radius: location.accuracy,
          color: '#1A56DB',
          fillColor: '#3B82F6',
          fillOpacity: 0.15,
          weight: 1.5
        }).addTo(mapInstanceRef.current);
      }
    } else if (circleInstanceRef.current) {
      circleInstanceRef.current.remove();
      circleInstanceRef.current = null;
    }
  }, [location?.lat, location?.lng, location?.accuracy, location?.isGpsDetected]);

  /**
   * 4. Switch Map Layer (Street vs Satellite Imagery)
   */
  const handleToggleLayer = () => {
    const nextLayer = activeLayer === 'street' ? 'satellite' : 'street';
    setActiveLayer(nextLayer);

    if (mapInstanceRef.current && layerInstanceRef.current) {
      mapInstanceRef.current.removeLayer(layerInstanceRef.current);
      const newConfig = TILE_LAYERS[nextLayer];
      const newLayer = L.tileLayer(newConfig.url, {
        attribution: newConfig.attribution,
        maxZoom: newConfig.maxZoom
      }).addTo(mapInstanceRef.current);
      layerInstanceRef.current = newLayer;
    }
  };

  /**
   * 5. Toggle Expand/Collapse Map View
   */
  const handleToggleExpand = () => {
    setIsExpanded((prev) => !prev);
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);
  };

  /**
   * 6. Live Continuous Real-Time GPS Tracking Mode
   */
  const toggleLiveTracking = () => {
    if (isLiveTracking) {
      if (watchIdRef.current !== null) {
        try { navigator.geolocation.clearWatch(watchIdRef.current); } catch (_) {}
        watchIdRef.current = null;
      }
      setIsLiveTracking(false);
      return;
    }

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLiveTracking(true);
    setGpsError(null);

    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy || 12);

          const dLat = (lat - NAGPUR_CENTER.lat) * 111;
          const dLng = (lng - NAGPUR_CENTER.lng) * 103;
          const distKm = Math.hypot(dLat, dLng);

          if (distKm <= 50) {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.6 });
            }
            handleLocationUpdate(lat, lng, accuracy, true);
          }
        },
        (err) => {
          console.warn('[LiveTracking] Error:', err);
          if (err.code === err.PERMISSION_DENIED) {
            setGpsError('Location permission was denied. Please allow location access in your browser.');
            setIsLiveTracking(false);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
      watchIdRef.current = id;
    } catch (e) {
      setGpsError('Failed to start live GPS tracking.');
      setIsLiveTracking(false);
    }
  };

  /**
   * 7. Multi-Sample Precision GPS Lock
   * Samples live positioning to achieve the lowest possible accuracy radius (meters),
   * flying directly into ultra-close Zoom 19 (doorstep level) wherever the user is in Nagpur.
   */
  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingGps(true);
    setGpsError(null);

    let bestPos = null;
    let samplesCount = 0;
    let sampleWatchId = null;

    const finalizeLock = (pos) => {
      if (sampleWatchId !== null) {
        try { navigator.geolocation.clearWatch(sampleWatchId); } catch (_) {}
        sampleWatchId = null;
      }
      setIsDetectingGps(false);

      if (!pos) return;

      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy || 12);

      // Distance from Nagpur Zero Mile
      const dLat = (rawLat - NAGPUR_CENTER.lat) * 111;
      const dLng = (rawLng - NAGPUR_CENTER.lng) * 103;
      const distFromNagpurKm = Math.hypot(dLat, dLng);

      // If coordinates are clearly from a remote ISP cellular hub outside Nagpur district (>50 km away, e.g. Waghpur ~137km)
      if (distFromNagpurKm > 50) {
        setGpsError(
          `Detected location (${rawLat.toFixed(2)}°, ${rawLng.toFixed(2)}°) is ${distFromNagpurKm.toFixed(0)} km away (remote ISP cellular node). On laptop/PC, please make sure "Location services" is turned ON in Windows Settings, or search your college/colony in the search box above, or drag the map pin.`
        );
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([NAGPUR_CENTER.lat, NAGPUR_CENTER.lng], 15, { duration: 1.0 });
        }
        handleLocationUpdate(NAGPUR_CENTER.lat, NAGPUR_CENTER.lng, null, false);
        return;
      }

      // Inside Nagpur: User is at home, college, or anywhere in the city -> Use real GPS coordinates directly!
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([rawLat, rawLng], 19, { duration: 1.2 });
      }

      handleLocationUpdate(rawLat, rawLng, accuracy, true);
    };

    // Refinement timeout: after 3 seconds, lock on the best reading
    const timer = setTimeout(() => {
      if (bestPos) {
        finalizeLock(bestPos);
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => finalizeLock(pos),
          (err) => {
            setIsDetectingGps(false);
            if (err.code === err.PERMISSION_DENIED) {
              setGpsError('Location permission denied. Please click the lock 🔒 icon in your browser address bar to allow Location access.');
            } else if (err.code === err.TIMEOUT) {
              setGpsError('GPS signal timed out. Please try again or drag the pin on the map.');
            } else {
              setGpsError('Unable to detect high-accuracy GPS. Drag the map pin to select your exact doorstep.');
            }
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    }, 3000);

    try {
      sampleWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          samplesCount++;
          if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
            bestPos = pos;
          }

          // If high accuracy (<= 20m) or multiple samples collected, lock immediately
          if (pos.coords.accuracy <= 20 || samplesCount >= 3) {
            clearTimeout(timer);
            finalizeLock(bestPos);
          }
        },
        (err) => {
          console.warn('[GPS Detection] watchPosition:', err);
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
      );
    } catch (e) {
      clearTimeout(timer);
      navigator.geolocation.getCurrentPosition(
        (pos) => finalizeLock(pos),
        (err) => {
          setIsDetectingGps(false);
          setGpsError('Location access failed. Please drag the pin on the map.');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  };

  /**
   * Reset Pin to Nagpur Zero Mile Center
   */
  const handleResetToNagpurCenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([NAGPUR_CENTER.lat, NAGPUR_CENTER.lng], 15, { duration: 1 });
    }
    handleLocationUpdate(NAGPUR_CENTER.lat, NAGPUR_CENTER.lng, null, false, NAGPUR_CENTER.defaultAddress);
    setGpsError(null);
  };

  /**
   * Zoom closely into the current marker for street-level pin fine-tuning
   */
  const handleZoomToPin = () => {
    if (mapInstanceRef.current) {
      const lat = location?.lat || NAGPUR_CENTER.lat;
      const lng = location?.lng || NAGPUR_CENTER.lng;
      mapInstanceRef.current.flyTo([lat, lng], 19, { duration: 0.8 });
    }
  };

  /**
   * 8. 1-Click "Use as Nearest Landmark"
   */
  const handleUseAsLandmark = () => {
    if (!onSetLandmark || !location?.address) return;
    const parts = location.address.split(',');
    const landmarkText = parts.length > 1 ? `${parts[0].trim()}, ${parts[1].trim()}` : parts[0].trim();
    onSetLandmark(landmarkText);
    setCopiedLandmark(true);
    setTimeout(() => setCopiedLandmark(false), 2000);
  };

  return (
    <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3.5 shadow-2xs">
      
      {/* LocationPicker Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200/70 pb-3">
        <div>
          <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>🗺️</span>
            <span>6. Pinpoint Defect Location (Nagpur Civic GIS Map)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time GPS Tracking &bull; Satellite Imagery &bull; Doorstep Pin Fine-Tuning
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          {/* Detect Location Button */}
          <button
            type="button"
            onClick={handleDetectCurrentLocation}
            disabled={isDetectingGps || isLiveTracking}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
              isDetectingGps
                ? 'bg-blue-100 text-blue-700 cursor-wait'
                : 'bg-[#1A56DB] hover:bg-blue-700 text-white active:scale-95'
            }`}
          >
            {isDetectingGps ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Detecting GPS...</span>
              </>
            ) : (
              <>
                <span>🎯</span>
                <span>Detect Location</span>
              </>
            )}
          </button>

          {/* Live Tracking Mode Toggle */}
          <button
            type="button"
            onClick={toggleLiveTracking}
            title={isLiveTracking ? 'Click to Stop Live GPS Tracking' : 'Continuous real-time GPS tracking'}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
              isLiveTracking
                ? 'bg-emerald-600 text-white border-emerald-700 animate-pulse'
                : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLiveTracking ? 'bg-white animate-ping' : 'bg-emerald-500'}`}></span>
            <span>{isLiveTracking ? 'Tracking Live' : 'Live Track'}</span>
          </button>

          {/* Satellite vs Street Layer Toggle */}
          <button
            type="button"
            onClick={handleToggleLayer}
            title={`Switch to ${activeLayer === 'street' ? 'Satellite Aerial View' : 'Street Map View'}`}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <span>{activeLayer === 'street' ? '🛰️ Satellite' : '🗺️ Street'}</span>
          </button>

          {/* Expand / Shrink Map Toggle */}
          <button
            type="button"
            onClick={handleToggleExpand}
            title={isExpanded ? 'Shrink Map View' : 'Expand Map for detailed doorstep view'}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <span>{isExpanded ? '🗗 Compact' : '⛶ Expand'}</span>
          </button>

          {/* Zoom to Pin */}
          <button
            type="button"
            onClick={handleZoomToPin}
            title="Zoom directly into Doorstep Level (Zoom 19)"
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <span>🔍 Doorstep Zoom 19</span>
          </button>

          {/* Reset to Nagpur Zero Mile */}
          <button
            type="button"
            onClick={handleResetToNagpurCenter}
            title="Reset to Nagpur Zero Mile Stone"
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
          >
            Zero Mile
          </button>
        </div>
      </div>

      {/* 🔍 FAST STREET / LANDMARK SEARCH BAR WITH AUTO-SUGGESTIONS */}
      <div ref={searchContainerRef} className="relative z-30">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchLocation(e);
                }
              }}
              onFocus={() => {
                if (searchQuery.trim().length > 0 && suggestions.length > 0) {
                  setIsDropdownOpen(true);
                }
              }}
              placeholder="Search location..."
              className="w-full pl-9 pr-8 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none flex items-center justify-center">
              {isLoadingSuggestions ? (
                <svg className="animate-spin w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              ) : (
                '🔍'
              )}
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setIsDropdownOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                &times;
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearchLocation}
            disabled={isSearchingLocation || !searchQuery.trim()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1 shadow-xs"
          >
            {isSearchingLocation ? (
              <span>Locating...</span>
            ) : (
              <span>Find Location</span>
            )}
          </button>
        </div>

        {/* Live Google Maps-Style Suggestions Dropdown */}
        {isDropdownOpen && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 animate-fadeIn max-h-72 overflow-y-auto">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Nagpur Live Places ({suggestions.length})</span>
              {isLoadingSuggestions ? (
                <span className="text-blue-600 animate-pulse lowercase font-normal">searching...</span>
              ) : (
                <span className="text-slate-400 lowercase font-normal">tap to pinpoint</span>
              )}
            </div>
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/80 transition-colors flex items-center justify-between gap-3 border-b border-slate-100 last:border-0 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0 group-hover:scale-110 transition-transform">
                    {item.icon || '📍'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700 truncate">
                      {item.name}
                    </div>
                    <div className="text-[10.5px] text-slate-500 truncate">
                      {item.area}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-[9.5px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-800 transition-colors">
                  {item.category || 'Location'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* No suggestions notice */}
        {isDropdownOpen && searchQuery.trim().length > 1 && suggestions.length === 0 && !isLoadingSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl p-3 z-50 text-center text-xs text-slate-500">
            <span>No location found for "{searchQuery}". Try typing a nearby street, chowk, or colony.</span>
          </div>
        )}
      </div>

      {/* 📍 QUICK NAGPUR NEIGHBORHOOD CHIPS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-0.5">
          Quick Areas:
        </span>
        {QUICK_LOCATIONS.map((loc) => (
          <button
            key={loc.label}
            type="button"
            onClick={() => handleSelectQuickLocation(loc)}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold border border-slate-200 transition-all cursor-pointer shrink-0 shadow-2xs text-[10.5px]"
          >
            📍 {loc.label}
          </button>
        ))}
      </div>

      {/* GPS Error Alert */}
      {gpsError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2 animate-fadeIn">
          <span className="text-sm shrink-0">⚠️</span>
          <div className="flex-1">
            <span>{gpsError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGpsError(null)}
            className="text-amber-600 font-bold hover:text-amber-900 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Leaflet Map Canvas Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-300 shadow-inner transition-all duration-300">
        <div
          ref={mapContainerRef}
          style={{ height: isExpanded ? '520px' : '340px', width: '100%', transition: 'height 0.3s ease' }}
          className="z-10"
        />

        {/* Live Map Watermark / Overlay Badges */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none flex flex-col gap-1.5">
          {/* Coordinates Badge */}
          <div className="bg-slate-900/85 backdrop-blur-sm text-white px-3 py-1 rounded-xl text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{location?.lat?.toFixed(5)}° N, {location?.lng?.toFixed(5)}° E</span>
          </div>

          {/* Accuracy Indicator Badge */}
          {location?.accuracy && location.accuracy > 0 ? (
            location.accuracy <= 30 ? (
              <div className="bg-emerald-600/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1">
                <span>🎯 High Precision: &plusmn;{location.accuracy}m</span>
              </div>
            ) : location.accuracy <= 80 ? (
              <div className="bg-blue-600/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1">
                <span>📍 Good Accuracy: &plusmn;{location.accuracy}m</span>
              </div>
            ) : (
              <div className="bg-amber-600/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1">
                <span>📡 Network Approx: &plusmn;{location.accuracy}m &bull; Drag pin for exact spot</span>
              </div>
            )
          ) : (
            <div className="bg-slate-700/80 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-[10px] font-medium shadow-xs">
              📌 Drag pin or tap map to adjust location
            </div>
          )}

          {/* Live Tracking Mode Pill */}
          {isLiveTracking && (
            <div className="bg-emerald-700/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1 animate-pulse">
              <span>🟢 Live GPS Tracking Active</span>
            </div>
          )}

          {/* Active Layer Pill */}
          <div className="bg-slate-800/80 backdrop-blur-sm text-slate-200 px-2 py-0.5 rounded-md text-[9.5px] font-medium border border-white/10">
            Layer: {activeLayer === 'street' ? 'OpenStreetMap' : 'Esri Satellite Imagery'}
          </div>
        </div>
      </div>

      {/* Accuracy & Desktop Notice */}
      <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100/80 text-[11px] text-blue-900 flex items-start gap-2">
        <span className="text-sm shrink-0">💡</span>
        <div className="leading-relaxed">
          <strong className="text-blue-950 font-bold">100% Accurate Positioning: </strong>
          Tap <strong>"Detect Location"</strong> for instant GPS, switch to <strong>"🛰️ Satellite"</strong> to see exact roads and rooftops, or <strong>drag the red pin</strong> directly onto your building doorstep!
        </div>
      </div>

      {/* Reverse Geocoded Address Card */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 font-bold text-[11px] uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-slate-700">
            <span>📍</span> Selected Street Address
          </span>
          {isGeocoding ? (
            <span className="text-blue-600 animate-pulse font-normal lowercase">resolving street address...</span>
          ) : (
            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
              location?.isGpsDetected 
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                : 'text-indigo-700 bg-indigo-50 border-indigo-200'
            }`}>
              {location?.isGpsDetected ? '✓ GPS Verified' : '📌 Manual Street Pin'}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-800 font-medium leading-relaxed">
          {location?.address || NAGPUR_CENTER.defaultAddress}
        </p>

        {/* Municipal Jurisdiction & Landmark Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-semibold">JMC Jurisdiction:</span>
            <span className="font-bold text-[#1A56DB] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              {detectedWard.name}
            </span>
            {!isWardMatching && onSelectWard && (
              <button
                type="button"
                onClick={() => onSelectWard(detectedWard.id)}
                className="text-[10.5px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                title={`Sync Section 2 to ${detectedWard.id}`}
              >
                🔄 Sync to {detectedWard.id}
              </button>
            )}
          </div>

          {onSetLandmark && (
            <button
              type="button"
              onClick={handleUseAsLandmark}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                copiedLandmark
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200'
              }`}
              title="Copy this address into Section 4 Nearest Landmark"
            >
              <span>{copiedLandmark ? '✓ Set in Landmark' : '📋 Use as Nearest Landmark'}</span>
            </button>
          )}
        </div>

        {/* Coordinates Details Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
          <span className="bg-slate-100 px-2 py-0.5 rounded-md">
            Lat: <strong>{location?.lat?.toFixed(6)}</strong>
          </span>
          <span className="bg-slate-100 px-2 py-0.5 rounded-md">
            Lng: <strong>{location?.lng?.toFixed(6)}</strong>
          </span>
          {location?.accuracy && (
            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
              Radius: &plusmn;{location.accuracy}m
            </span>
          )}
        </div>
      </div>

    </div>
  );
};

/**
 * ==============================================================================
 * CitizenSubmit Master Form Component
 * ==============================================================================
 */
export const CitizenSubmit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Hidden File Input References
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const videoRef = useRef(null);

  // Helper to extract default ward from user profile
  const parseProfileWard = () => {
    if (!user?.ward) return 'Ward 4';
    const w = String(user.ward).toLowerCase();
    if (w.includes('1')) return 'Ward 1';
    if (w.includes('2')) return 'Ward 2';
    if (w.includes('3')) return 'Ward 3';
    return 'Ward 4';
  };

  const resolveInitialCategory = () => {
    const raw = String(searchParams.get('category') || '').trim().toUpperCase();
    if (['PWD', 'SWM', 'PHE', 'ELE'].includes(raw)) return raw;
    if (raw === 'ELEC' || raw === 'ELECTRICAL') return 'ELE';
    return 'PWD';
  };

  // Form State
  const [selectedCategory, setSelectedCategory] = useState(resolveInitialCategory);
  const [selectedWard, setSelectedWard] = useState(parseProfileWard());
  const [description, setDescription] = useState('');
  const [landmark, setLandmark] = useState('');

  // Day 12 Photo Upload State
  const [photos, setPhotos] = useState([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [lastCompressionSummary, setLastCompressionSummary] = useState(null);
  const [previewLightbox, setPreviewLightbox] = useState(null);

  // Day 13 LocationPicker State (Nagpur Center Default)
  const [location, setLocation] = useState({
    lat: NAGPUR_CENTER.lat,
    lng: NAGPUR_CENTER.lng,
    address: NAGPUR_CENTER.defaultAddress,
    accuracy: null,
    isGpsDetected: false,
    timestamp: new Date().toISOString()
  });

  // Live Camera / Webcam Viewfinder State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState(null);
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);

  // UI / Validation State
  const [touched, setTouched] = useState({ description: false });
  const [draftSaved, setDraftSaved] = useState(false);

  // Day 14 API Submission, Loading & Success Modal States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState('Uploading photos & running AI verification...');
  const [submitError, setSubmitError] = useState(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Sync ward if user profile changes
  useEffect(() => {
    if (user?.ward) {
      setSelectedWard(parseProfileWard());
    }
  }, [user]);

  // Clean up camera stream if component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  // Attach camera stream to video tag
  useEffect(() => {
    if (isCameraModalOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => {
        console.warn('[Camera] Autoplay interrupted:', err);
      });
    }
  }, [isCameraModalOpen, cameraStream]);

  // Validation constants
  const minChars = 15;
  const maxChars = 500;
  const maxPhotosAllowed = 3;
  const maxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

  const currentLength = description.trim().length;
  const isDescriptionValid = currentLength >= minChars;
  const charsRemaining = minChars - currentLength;
  const isFormValid = Boolean(selectedCategory) && isDescriptionValid;

  const activeCategoryObj = CATEGORIES.find((c) => c.id === selectedCategory);

  /**
   * Start Live Camera / Webcam Stream (Triggers Browser Permission Prompt)
   */
  const startCameraStream = async (facing = cameraFacingMode) => {
    if (photos.length >= maxPhotosAllowed) {
      setUploadError(`Maximum ${maxPhotosAllowed} photos allowed.`);
      return;
    }

    setUploadError(null);
    setCameraError(null);
    setIsCameraModalOpen(true);

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam / Camera API is not supported on this browser.');
      }

      const constraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
    } catch (err) {
      console.warn('[Camera] getUserMedia failed with facingMode constraint:', err);

      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setCameraStream(fallbackStream);
      } catch (fallbackErr) {
        console.error('[Camera] Complete camera failure:', fallbackErr);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          setCameraError('Camera permission was blocked. Please click the camera/lock icon in your browser address bar and select "Allow".');
        } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
          setCameraError('No camera device detected. You can select photos from your device storage instead.');
        } else {
          setCameraError(fallbackErr.message || 'Unable to open camera on this device.');
        }
      }
    }
  };

  /**
   * Stop Live Camera Stream
   */
  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraModalOpen(false);
    setCameraError(null);
  };

  /**
   * Toggle Front/Back Camera
   */
  const handleToggleFacingMode = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    startCameraStream(nextFacing);
  };

  /**
   * Capture Frame from Live Camera Stream
   */
  const capturePhotoFromStream = async () => {
    if (!videoRef.current || isCapturingFrame) return;

    if (photos.length >= maxPhotosAllowed) {
      setUploadError(`Maximum ${maxPhotosAllowed} photos allowed.`);
      stopCameraStream();
      return;
    }

    setIsCapturingFrame(true);

    try {
      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 960;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, 0, 0, width, height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) throw new Error('Could not create snapshot blob');

      const photoFile = new File([blob], `civic-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Run through canvas optimization pipeline
      await handleFilesSelected([photoFile]);

      stopCameraStream();
    } catch (err) {
      console.error('[Camera] Frame snapshot error:', err);
      setCameraError('Failed to capture snapshot from camera.');
    } finally {
      setIsCapturingFrame(false);
    }
  };

  /**
   * Handle File Selection from Camera Input or Gallery
   */
  const handleFilesSelected = async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    setUploadError(null);
    const filesArray = Array.from(fileList);

    const availableSlots = maxPhotosAllowed - photos.length;
    if (availableSlots <= 0) {
      setUploadError(`Maximum ${maxPhotosAllowed} photos allowed. Please remove a photo to upload a new one.`);
      return;
    }

    const filesToProcess = filesArray.slice(0, availableSlots);
    if (filesArray.length > availableSlots) {
      setUploadError(`Only ${availableSlots} more photo(s) could be added. Max limit is 3.`);
    }

    for (const file of filesToProcess) {
      if (file.size > maxFileSizeBytes) {
        setUploadError(`"${file.name}" exceeds 5MB limit (${formatFileSize(file.size)}). Please choose a photo under 5MB.`);
        return;
      }
    }

    setIsCompressing(true);

    try {
      const compressedResults = [];
      let totalOriginal = 0;
      let totalCompressed = 0;

      for (const file of filesToProcess) {
        const result = await compressImageWithCanvas(file, 1280, 0.82);
        compressedResults.push(result);
        totalOriginal += result.originalSize;
        totalCompressed += result.compressedSize;
      }

      setPhotos((prev) => [...prev, ...compressedResults]);

      const overallSaved = Math.max(0, Math.round(((totalOriginal - totalCompressed) / totalOriginal) * 100));
      setLastCompressionSummary({
        count: compressedResults.length,
        original: formatFileSize(totalOriginal),
        compressed: formatFileSize(totalCompressed),
        savedPct: overallSaved
      });
    } catch (err) {
      console.error('[Submit] Photo compression error:', err);
      setUploadError('Failed to process image. Please try another photo.');
    } finally {
      setIsCompressing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (photoId) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setUploadError(null);
  };

  const handleSetPrimary = (photoId) => {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === photoId);
      if (idx <= 0) return prev;
      const target = prev[idx];
      const remaining = prev.filter((p) => p.id !== photoId);
      return [target, ...remaining];
    });
  };

  /**
   * Day 14: Form Submission Action
   * Submits multipart FormData to backend API: POST /api/v1/complaints/
   * (category, ward, description, photos, lat, lng)
   */
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setTouched({ description: true });

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitStage('Uploading photos & running AI verification...');

    // 1. Construct Multipart FormData payload
    const formData = new FormData();
    const citizenMobile = user?.username || user?.phone || user?.mobile || '';
    if (citizenMobile) {
      formData.append('citizen_mobile', citizenMobile);
      formData.append('mobile', citizenMobile);
    }
    if (user?.name || user?.full_name) {
      formData.append('citizen_name', user.name || user.full_name);
    }
    formData.append('category', activeCategoryObj?.title || selectedCategory);
    formData.append('category_code', selectedCategory);
    formData.append('category_id', activeCategoryObj?.deptId || 1);
    formData.append('department', activeCategoryObj?.department || 'PWD');
    formData.append('ward', selectedWard);
    formData.append('ward_number', selectedWard.replace(/\D/g, '') || '4');
    formData.append('description', description.trim());
    if (landmark.trim()) {
      formData.append('landmark', landmark.trim());
    }
    formData.append('lat', location.lat);
    formData.append('lng', location.lng);
    formData.append('latitude', location.lat);
    formData.append('longitude', location.lng);
    formData.append('address', location.address || NAGPUR_CENTER.defaultAddress);
    if (location.accuracy) {
      formData.append('accuracy', location.accuracy);
    }
    formData.append('is_gps_detected', location.isGpsDetected ? 'true' : 'false');

    // Attach compressed photo files
    photos.forEach((photo, idx) => {
      if (photo.compressedBlob) {
        formData.append('photos', photo.compressedBlob, photo.name || `civic_issue_${idx + 1}.jpg`);
      }
    });

    try {
      // 2. Execute POST with smooth animated pulse loader duration (min 1.4s)
      const [response] = await Promise.all([
        api.post('/api/v1/complaints/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: 60000
        }),
        new Promise((resolve) => setTimeout(resolve, 1400))
      ]);

      const data = response.data;

      // 3. Clear draft cache upon successful submission
      try {
        sessionStorage.removeItem('janmitra_draft_complaint');
      } catch (cacheErr) {
        console.warn('[Submit] Failed to clear sessionStorage draft:', cacheErr);
      }

      const ticketId = data.tracking_id || data.id || 'JMC-2026-018';
      const complaintId = data.id || ticketId;

      const slaMap = { '24h': '24 hours', '48h': '48 hours', '72h': '72 hours', '7 days': '7 days' };
      const rawSla = data.target_sla || data.sla || '48h';
      const slaReadable = slaMap[rawSla] || rawSla;

      setSubmittedComplaint({
        id: complaintId,
        tracking_id: ticketId,
        title: data.title || `${activeCategoryObj?.title} Issue`,
        category: data.category || activeCategoryObj?.title,
        department: data.department || activeCategoryObj?.department,
        ward: data.ward || selectedWard,
        address: location.address || data.address || NAGPUR_CENTER.defaultAddress,
        status: data.status || 'Submitted',
        priority_level: data.priority_level || data.priority || 'Medium',
        priority_score: data.priority_score ?? 50,
        sla_hours: data.sla_hours || 48,
        expected_sla: `Priority: ${data.priority_level || 'Medium'} (${data.priority_score ?? 50}/100) • Target SLA: ${slaReadable}`,
        ai_validated: data.status === 'Validated' || Boolean(data.ai_validated),
        ai_confidence: data.ai_confidence,
        citizen_message: data.citizen_message || '',
        is_duplicate: Boolean(data.is_duplicate),
        photo_count: photos.length,
        submitted_at: data.submitted_at || new Date().toISOString()
      });

      setIsSubmitting(false);
      setIsSuccessModalOpen(true);

    } catch (err) {
      console.error('[Submit] API submission failed:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.message || err.message;
      setSubmitError(errMsg || 'Failed to submit complaint. Please check your network and try again.');
      setIsSubmitting(false);
    }
  };

  /**
   * Copy Generated Complaint Tracking ID to Clipboard
   */
  const handleCopyTicket = (ticketId) => {
    if (!ticketId) return;
    try {
      navigator.clipboard.writeText(ticketId);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2500);
    } catch (err) {
      console.warn('[Submit] Clipboard copy failed:', err);
    }
  };

  /**
   * Reset form to submit another complaint
   */
  const handleResetForm = () => {
    setIsSuccessModalOpen(false);
    setSubmittedComplaint(null);
    setDescription('');
    setLandmark('');
    setPhotos([]);
    setTouched({ description: false });
    setLocation({
      lat: NAGPUR_CENTER.lat,
      lng: NAGPUR_CENTER.lng,
      address: NAGPUR_CENTER.defaultAddress,
      accuracy: null,
      isGpsDetected: false,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-7 font-sans">
      
      {/* Hidden File Inputs for Native System Fallbacks */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {/* ================= 1. PAGE HEADER WITH BACK BUTTON TO /citizen ================= */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <button
          type="button"
          onClick={() => navigate('/citizen')}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-[#1A56DB] bg-white border border-slate-200 hover:border-blue-300 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl transition duration-150 shadow-xs active:scale-95 group cursor-pointer"
          aria-label="Back to Citizen Home"
        >
          <span className="text-base sm:text-lg leading-none group-hover:-translate-x-1 transition-transform">←</span>
          <span>Back to /citizen</span>
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[11px] font-bold text-blue-700">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
          <span>Municipal Corporation Grievance Portal</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-[#0d2a53] via-[#12396d] to-[#1A56DB] text-white p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
                Municipal Corporation &bull; Civic Redressal
              </span>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                Report New Civic Issue
              </h1>
              <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-2xl leading-relaxed">
                Provide civic defect details, attach photos, and pinpoint the exact GPS location on the Nagpur municipal map.
              </p>
            </div>

            {/* Stepper Pill */}
            <div className="bg-white/10 border border-white/20 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-3 shrink-0 self-start sm:self-auto">
              <div className="w-8 h-8 rounded-xl bg-white text-[#0d2a53] font-black flex items-center justify-center text-sm shadow-sm">
                3/3
              </div>
              <div className="text-left text-xs">
                <span className="text-white font-bold block">Part 3 Active</span>
                <span className="text-blue-200 text-[11px]">GPS Map & Location</span>
              </div>
            </div>
          </div>

          {/* Progress Bar (Complete) */}
          <div className="w-full bg-white/20 h-2 rounded-full mt-5 overflow-hidden">
            <div className="bg-emerald-400 h-full rounded-full w-full transition-all duration-300"></div>
          </div>
        </div>

        {/* Form Body - Responsive 2-Column Grid on Laptop/Desktop, 1-Column on Phone */}
        <form onSubmit={handleFormSubmit} className="p-5 sm:p-7 lg:p-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            
            {/* ================= LEFT COLUMN: DETAILS & PHOTO UPLOADER (6 cols on Desktop) ================= */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* SECTION 1: 4 CATEGORY CARDS (GRID 2x2) */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>1. Select Issue Category</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Tap to select
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;

                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedCategory(cat.id);
                          }
                        }}
                        className={`relative p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between text-left select-none outline-none ${
                          isSelected
                            ? 'border-2 border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40 shadow-sm'
                            : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        {/* Top: Code & Checkmark */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                            isSelected
                              ? cat.colorClasses.badge
                              : cat.colorClasses.badgeLight
                          }`}>
                            [{cat.code}]
                          </span>

                          {isSelected ? (
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs ring-2 ring-blue-200 animate-scaleIn">
                              ✓
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white"></span>
                          )}
                        </div>

                        {/* Middle: Icon & Title */}
                        <div className="space-y-1.5 my-1">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg shrink-0 ${cat.colorClasses.iconBg}`}>
                              {cat.icon}
                            </div>
                            <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                              {cat.title}
                            </h2>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed hidden sm:block">
                            {cat.examples}
                          </p>
                        </div>

                        {/* Bottom: Dept Tag */}
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-slate-500">
                            {cat.colorName} Dept
                          </span>
                          {isSelected && (
                            <span className="font-bold text-blue-600">Selected</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: WARD SELECTOR */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="ward-select" className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>2. Municipal Ward</span>
                    <span className="text-red-500">*</span>
                  </label>
                  {user?.ward && (
                    <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      Profile Default: {selectedWard}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <select
                    id="ward-select"
                    value={selectedWard}
                    onChange={(e) => setSelectedWard(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold rounded-xl px-4 py-3.5 pr-10 appearance-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition shadow-inner"
                  >
                    {WARDS.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} &bull; {w.area}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* SECTION 3: DESCRIPTION FIELD */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="description-textarea" className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>3. Issue Description</span>
                    <span className="text-red-500">*</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${
                      isDescriptionValid ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                      {currentLength} / {maxChars} chars
                    </span>

                    {isDescriptionValid ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <span>✓</span> Min 15 met
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        Min 15 chars ({charsRemaining > 0 ? charsRemaining : 0} more)
                      </span>
                    )}
                  </div>
                </div>

                <textarea
                  id="description-textarea"
                  rows="3"
                  value={description}
                  maxLength={maxChars}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (!touched.description) setTouched({ description: true });
                  }}
                  onBlur={() => setTouched({ description: true })}
                  placeholder="Describe the defect in detail (min 15 characters). E.g., Broken water supply pipe leaking onto pedestrian footpath and road..."
                  className={`w-full text-sm font-medium rounded-xl p-4 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                    touched.description && !isDescriptionValid
                      ? 'border-amber-400 bg-amber-50/30 focus:border-amber-500 focus:ring-amber-500/30'
                      : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-blue-600/30'
                  } border`}
                ></textarea>

                {touched.description && !isDescriptionValid && (
                  <p className="text-xs text-amber-700 font-semibold mt-1.5 flex items-center gap-1">
                    <span>⚠️</span> Description too short. Please write at least 15 characters ({charsRemaining} characters left).
                  </p>
                )}
              </div>

              {/* SECTION 4: LANDMARK INPUT */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="landmark-field" className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>4. Nearest Landmark</span>
                    <span className="text-[11px] font-normal text-slate-400 normal-case">(Optional)</span>
                  </label>
                  <span className="text-[11px] font-medium text-slate-400">
                    Assists field workers
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    📍
                  </div>
                  <input
                    id="landmark-field"
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g., Near Medical Square Metro Pillar #42, opp. Bank of India"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm font-medium rounded-xl pl-10 pr-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              {/* SECTION 5: PHOTO UPLOADER & THUMBNAILS */}
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                      <span>📸</span>
                      <span>5. Attach Issue Photos</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Up to 3 photos (&lt; 5MB each)
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    photos.length === maxPhotosAllowed
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200'
                  }`}>
                    {photos.length} / {maxPhotosAllowed} Photos
                  </span>
                </div>

                {/* Upload Buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => startCameraStream()}
                    disabled={photos.length >= maxPhotosAllowed || isCompressing}
                    className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition text-center shadow-xs cursor-pointer ${
                      photos.length >= maxPhotosAllowed || isCompressing
                        ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                        : 'bg-white hover:bg-blue-50/60 border-blue-300 text-[#1A56DB] hover:border-blue-500 active:scale-95'
                    }`}
                  >
                    <span>📷</span>
                    <span className="text-xs font-bold">Take Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={photos.length >= maxPhotosAllowed || isCompressing}
                    className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition text-center shadow-xs cursor-pointer ${
                      photos.length >= maxPhotosAllowed || isCompressing
                        ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                        : 'bg-white hover:bg-emerald-50/60 border-emerald-300 text-emerald-700 hover:border-emerald-500 active:scale-95'
                    }`}
                  >
                    <span>🖼️</span>
                    <span className="text-xs font-bold">From Gallery</span>
                  </button>
                </div>

                {/* Photo Optimization Summary Banner */}
                {lastCompressionSummary && !isCompressing && (
                  <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl text-emerald-950 text-[11px] flex items-center justify-between gap-2 animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>
                        Photo optimized to <strong>{lastCompressionSummary.compressed}</strong> ({lastCompressionSummary.savedPct}% size reduced)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100 px-1.5 py-0.5 rounded">
                      Optimized
                    </span>
                  </div>
                )}

                {/* Thumbnails Row */}
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {photos.map((photo, index) => {
                      const isPrimary = index === 0;
                      return (
                        <div
                          key={photo.id}
                          className={`relative rounded-xl overflow-hidden border bg-white shadow-2xs group aspect-square flex items-center justify-center ${
                            isPrimary ? 'border-amber-400 ring-2 ring-amber-300/30' : 'border-slate-200'
                          }`}
                        >
                          <img
                            src={photo.dataUrl}
                            alt={`Defect ${index + 1}`}
                            onClick={() => setPreviewLightbox(photo)}
                            className="w-full h-full object-cover cursor-pointer"
                          />
                          {isPrimary && (
                            <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                              ★ Main
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(photo.id)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white text-[10px] font-bold flex items-center justify-center transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* ================= RIGHT COLUMN: INTERACTIVE LEAFLET LOCATION PICKER (6 cols on Desktop) ================= */}
            <div className="lg:col-span-6 space-y-5">
              
              {/* Standalone LocationPicker Subcomponent */}
              <LocationPicker
                location={location}
                onLocationChange={(newLoc) => setLocation(newLoc)}
                selectedWard={selectedWard}
                onSelectWard={(w) => setSelectedWard(w)}
                onSetLandmark={(lm) => setLandmark(lm)}
              />

              {/* Civic Submission Summary Note */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 text-xs text-blue-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-blue-800">
                  <span>ℹ️</span> Accurate Civic Verification
                </div>
                <p className="text-[11px] text-blue-800/80 leading-relaxed">
                  Your GPS coordinates are automatically mapped to Nagpur Municipal Corporation's spatial database. This ensures the correct local ward field workers are dispatched directly to the repair site.
                </p>
              </div>

            </div>

          </div>

          {/* ================= SUBMISSION ERROR BANNER ================= */}
          {submitError && (
            <div className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                  <span>⚠️</span> Submission Failed
                </span>
                <button
                  type="button"
                  onClick={() => setSubmitError(null)}
                  className="text-xs text-red-600 hover:text-red-900 font-bold"
                >
                  &times; Dismiss
                </button>
              </div>
              <p className="text-xs text-red-700 leading-relaxed">
                {submitError}
              </p>
              <div className="pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Retry Submission
                </button>
              </div>
            </div>
          )}

          {/* ================= ACTION BUTTONS ================= */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {!isDescriptionValid && currentLength > 0 && (
                <span className="text-amber-600 font-medium">
                  ⚠️ Description requires {charsRemaining} more character{charsRemaining > 1 ? 's' : ''} to submit.
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => navigate('/citizen')}
                className="w-full sm:w-auto py-3.5 px-6 rounded-2xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer order-2 sm:order-1"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className={`w-full sm:w-auto py-4 px-8 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-md order-1 sm:order-2 ${
                  isFormValid && !isSubmitting
                    ? 'bg-[#1A56DB] hover:bg-[#1546b5] text-white shadow-blue-600/25 active:scale-[0.99] cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Submitting Complaint...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Civic Complaint</span>
                    <span className="text-base font-bold">&rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400 mt-5">
            Municipal Corporation &bull; Citizen Grievance Redressal System &bull; Lead: Faizan Rayeen
          </div>
        </form>

      </div>

      {/* ================= LIVE WEBCAM / CAMERA VIEWFINDER MODAL ================= */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl overflow-hidden max-w-lg w-full border border-slate-700 shadow-2xl flex flex-col animate-scaleIn">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-xs sm:text-sm font-black tracking-wide uppercase">
                  Live Camera Viewfinder
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  title="Switch camera"
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 cursor-pointer"
                >
                  <span>🔄</span>
                  <span className="hidden sm:inline">Flip</span>
                </button>

                <button
                  type="button"
                  onClick={stopCameraStream}
                  aria-label="Close camera"
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-red-600 text-white font-bold flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Video Viewport / Error Display */}
            <div className="relative bg-black w-full aspect-4/3 sm:aspect-16/10 flex items-center justify-center overflow-hidden">
              {cameraError ? (
                <div className="p-6 text-center space-y-3 max-w-sm">
                  <div className="w-12 h-12 mx-auto rounded-full bg-red-900/60 text-red-300 flex items-center justify-center text-2xl">
                    🚫
                  </div>
                  <h3 className="text-sm font-bold text-white">Camera Access Error</h3>
                  <p className="text-xs text-red-200/90 leading-relaxed">
                    {cameraError}
                  </p>
                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => startCameraStream()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
                    >
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopCameraStream();
                        cameraInputRef.current?.click();
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
                    >
                      Select Photo from Device Instead
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute inset-4 sm:inset-6 pointer-events-none border border-white/30 rounded-2xl flex flex-col justify-between p-2">
                    <div className="flex justify-between text-[10px] text-white/70 font-mono">
                      <span>[REC LIVE]</span>
                      <span>1280p</span>
                    </div>
                    <div className="text-center text-[11px] text-white/80 bg-black/40 backdrop-blur-xs py-1 px-3 rounded-full mx-auto font-medium">
                      Position civic issue inside frame
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Shutter Controls Footer */}
            <div className="p-4 sm:p-5 bg-slate-950 flex items-center justify-between gap-4 border-t border-slate-800">
              <button
                type="button"
                onClick={stopCameraStream}
                className="text-xs font-bold text-slate-400 hover:text-white transition px-3 py-2 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={Boolean(cameraError) || isCapturingFrame}
                onClick={capturePhotoFromStream}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-full font-black text-xs sm:text-sm text-white shadow-lg transition active:scale-95 cursor-pointer ${
                  cameraError || isCapturingFrame
                    ? 'opacity-40 bg-slate-700 cursor-not-allowed'
                    : 'bg-[#1A56DB] hover:bg-blue-600 ring-4 ring-blue-500/30'
                }`}
              >
                <span className="text-lg">📸</span>
                <span>{isCapturingFrame ? 'Capturing...' : 'Click Photo'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  galleryInputRef.current?.click();
                }}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition px-3 py-2 cursor-pointer"
              >
                Gallery &rarr;
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= LIGHTBOX ZOOM MODAL ================= */}
      {previewLightbox && (
        <div
          onClick={() => setPreviewLightbox(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl border border-white/20 animate-scaleIn"
          >
            <div className="relative bg-slate-900 max-h-[60vh] flex items-center justify-center overflow-hidden">
              <img
                src={previewLightbox.dataUrl}
                alt="Enlarged defect proof"
                className="max-h-[60vh] w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setPreviewLightbox(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white font-bold flex items-center justify-center hover:bg-red-600 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 truncate">
                  {previewLightbox.name}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                  {formatFileSize(previewLightbox.compressedSize)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Optimized to {previewLightbox.width} &times; {previewLightbox.height} px using HTML5 Canvas.
              </p>
              <button
                type="button"
                onClick={() => setPreviewLightbox(null)}
                className="w-full py-2.5 mt-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DAY 14: ANIMATED PULSE LOADER MODAL ================= */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center space-y-5 animate-scaleIn">
            
            {/* Animated Multi-Ring Pulse Radar */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping"></div>
              <div className="absolute inset-2 rounded-full bg-[#1A56DB]/30 animate-pulse"></div>
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1A56DB] to-cyan-400 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-500/30">
                <svg className="animate-spin w-7 h-7 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              </div>
            </div>

            {/* Heading & Subtitle */}
            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                {submitStage}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Please wait while the Municipal AI Engine processes defect photos and maps coordinates.
              </p>
            </div>

            {/* Step Progress Indicators */}
            <div className="w-full space-y-2 pt-2 text-left">
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-200 font-medium">1. Photos Compressed & Uploaded</span>
                <span className="ml-auto text-[10px] text-emerald-400 font-bold">✓ Ready</span>
              </div>
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                <span className="text-slate-200 font-medium">2. AI YOLOv8 Civic Verification</span>
                <span className="ml-auto text-[10px] text-blue-400 font-bold">Analyzing...</span>
              </div>
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-slate-400 font-medium">3. Ward Jurisdiction & SLA Routing</span>
                <span className="ml-auto text-[10px] text-slate-500 font-bold">Queued</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= DAY 14: SUCCESS CONFIRMATION MODAL ================= */}
      {isSuccessModalOpen && submittedComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden animate-scaleIn">
            
            {/* Green Celebratory Header */}
            <div className="bg-gradient-to-b from-emerald-50 via-emerald-50/40 to-white pt-8 pb-4 px-6 text-center space-y-3">
              
              {/* Green Checkmark Animation */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-200 animate-ping opacity-60"></div>
                <div className="relative w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <svg className="w-9 h-9 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Complaint Registered Successfully!
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                  Your civic issue has been officially logged with the Municipal Corporation portal.
                </p>
              </div>

              {/* Ticket Badge with Copy Button */}
              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-sm border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Complaint ID:</span>
                  <span className="text-sm sm:text-base font-black font-mono tracking-wider text-emerald-400">
                    {submittedComplaint.tracking_id}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyTicket(submittedComplaint.tracking_id)}
                    title="Copy Complaint ID"
                    className="ml-1 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-xs"
                  >
                    {copiedTicket ? '✓ Copied' : '📋'}
                  </button>
                </div>
              </div>

              {/* Expected SLA Badge */}
              <div className="pt-1 flex flex-col items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                  <span>⏱️</span>
                  <span>{submittedComplaint.expected_sla}</span>
                </span>
                {submittedComplaint.is_duplicate && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    📍 Duplicate within 100m detected — parent issue priority boosted
                  </span>
                )}
              </div>
            </div>

            {/* Summary Body */}
            <div className="p-5 sm:p-6 space-y-3.5 bg-slate-50 border-y border-slate-100 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
                  <span className="text-xs font-black text-slate-800 truncate block mt-0.5">
                    {submittedComplaint.category}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {submittedComplaint.department}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Ward</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">
                    {submittedComplaint.ward}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold block">
                    Status: {submittedComplaint.status}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">GPS Location</span>
                <p className="text-xs font-medium text-slate-800 line-clamp-2 leading-relaxed">
                  {submittedComplaint.address}
                </p>
                <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-slate-400">
                  <span>Nagpur Municipal Spatial DB</span>
                  <span>&bull;</span>
                  <span>{submittedComplaint.photo_count} Photo(s) Attached</span>
                </div>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="p-4 sm:p-6 bg-white space-y-2.5">
              <button
                type="button"
                onClick={() => navigate(`/citizen/complaint/${submittedComplaint.id || submittedComplaint.tracking_id}`)}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#1A56DB] hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <span>Track Issue Status</span>
                <span className="text-base">&rarr;</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/citizen')}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Back to Citizen Home
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
                >
                  + File Another Issue
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CitizenSubmit;
