function toggleReturn(type = null) {
  if (!type) {
    type = document.getElementById("tripType").dataset.value;
  } else {
    document.getElementById("tripType").dataset.value = type;
  }

  const isRoundTrip = type === "roundtrip";
  document.getElementById("returnSection").style.display = isRoundTrip ? "block" : "none";

  // Update button states
  document.getElementById("onewayBtn").classList.toggle("selected", !isRoundTrip);
  document.getElementById("roundtripBtn").classList.toggle("selected", isRoundTrip);

  if (isRoundTrip) {
    document.getElementById("returnOrigin").value = document.getElementById("destination").value;
    document.getElementById("returnDestination").value = document.getElementById("origin").value;
  }
}

function getRoute(origin, destination, waypoints = []) {
  return new Promise((resolve, reject) => {
    const service = new google.maps.DirectionsService();
    service.route({
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      travelMode: 'DRIVING'
    }, (result, status) => {
      if (status === 'OK') {
        const legs = result.routes[0].legs;
        const total = legs.reduce((acc, leg) => {
          acc.distance += leg.distance.value;
          acc.duration += leg.duration.value;
          return acc;
        }, { distance: 0, duration: 0 });
        resolve(total);
      } else {
        reject('החישוב נכשל: ' + status);
      }
    });
  });
}

function formatMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours > 0 ? hours + ' שעות ' : ''}${mins} דקות`;
}

async function calculateTrip() {
  const origin = document.getElementById("origin").value;
  const destination = document.getElementById("destination").value;
  const tripType = document.getElementById("tripType").value;
  const departureTime = document.getElementById("departureTime").value;
  const returnTime = document.getElementById("returnTime").value;

  const returnOrigin = document.getElementById("returnOrigin").value || destination;
  const returnDestination = document.getElementById("returnDestination").value || origin;

  // Collect stops for the main trip
  const stopInputs = document.querySelectorAll(".stop");
  const waypoints = Array.from(stopInputs)
    .filter(input => input.value.trim() !== "")
    .map(input => ({
      location: input.value,
      stopover: true
    }));

  // Collect stops for the return trip
  const returnStopInputs = document.querySelectorAll(".return-stop");
  const returnWaypoints = Array.from(returnStopInputs)
    .filter(input => input.value.trim() !== "")
    .map(input => ({
      location: input.value,
      stopover: true
    }));

  document.getElementById("result").innerText = "מחשב...";

  try {
    let go = await getRoute(origin, destination, waypoints);
    let totalDistance = go.distance;
    let totalDuration = go.duration;

    let back;
    if (tripType === 'roundtrip') {
      back = await getRoute(returnOrigin, returnDestination, returnWaypoints);
      totalDistance += back.distance;
      totalDuration += back.duration;
    }

    const km = (totalDistance / 1000).toFixed(1);
    const travelMinutes = Math.round(totalDuration / 60);
    const travelFormatted = formatMinutesToTime(travelMinutes);

    let totalTimeFormatted = '';
    if (tripType === 'roundtrip' && departureTime && returnTime) {
      const dep = new Date(`2000-01-01T${departureTime}:00`);
      let ret = new Date(`2000-01-01T${returnTime}:00`);
      if (ret < dep) {
        ret.setDate(ret.getDate() + 1); // Add a day if return is past midnight
      }
      const diffMinutes = (ret - dep) / (1000 * 60);
      const totalWithReturn = diffMinutes + back.duration / 60;
      totalTimeFormatted = formatMinutesToTime(Math.round(totalWithReturn));
    }

    document.getElementById("result").innerHTML =
      `ק״מ משוכלל: ${km} ק״מ<br>` +
      `זמן נסיעה כולל: ${travelFormatted}<br>` +
      (tripType === "roundtrip" ? `זמן כולל: ${totalTimeFormatted}` : "");
  } catch (err) {
    document.getElementById("result").innerText = err;
  }
}

// Improved Autocomplete with full place validation
function initAutocomplete() {
  const inputs = ["origin", "destination", "returnOrigin", "returnDestination"];

  inputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ["geocode"],
        fields: ["place_id", "geometry", "formatted_address", "name"]
      });

      autocomplete.setComponentRestrictions({ country: ["il"] });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        console.log(`Selected for #${id}:`, place);
        if (!place.geometry) {
          alert(`לא ניתן למצוא מיקום עבור: ${input.value}`);
        }
      });
    }
  });

  // Add autocomplete to all existing stop inputs (both outbound and return)
  document.querySelectorAll(".stop, .return-stop").forEach(input => {
    const autocomplete = new google.maps.places.Autocomplete(input, {
      types: ["geocode"],
      fields: ["place_id", "geometry", "formatted_address", "name"]
    });

    autocomplete.setComponentRestrictions({ country: ["il"] });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) {
        alert(`לא ניתן למצוא מיקום עבור: ${input.value}`);
      }
    });
  });
}

// Make initAutocomplete globally available for Google Maps callback
window.initAutocomplete = initAutocomplete;

// Add stop input dynamically with autocomplete and styling
function addStop(containerId = "stops-container", stopClass = "stop") {
  const container = document.getElementById(containerId);
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "עצירה בדרך";
  input.autocomplete = "off";
  input.className = stopClass;
  input.style.width = "100%";
  input.style.marginBottom = "10px";
  container.appendChild(input);

  const autocomplete = new google.maps.places.Autocomplete(input, {
    types: ["geocode"],
    fields: ["place_id", "geometry", "formatted_address", "name"]
  });
  autocomplete.setComponentRestrictions({ country: ["il"] });
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.geometry) {
      alert(`לא ניתן למצוא מיקום עבור: ${input.value}`);
    }
  });
}

// Reverse the outbound trip into the return trip
function applyReverseRoute() {
  document.getElementById("returnOrigin").value = document.getElementById("destination").value;
  document.getElementById("returnDestination").value = document.getElementById("origin").value;

  // Copy stops in reverse order
  const stops = Array.from(document.querySelectorAll(".stop"))
    .map(el => el.value)
    .filter(val => val.trim() !== "")
    .reverse();

  const container = document.getElementById("return-stops-container");
  container.innerHTML = "";
  stops.forEach(val => {
    addStop("return-stops-container", "return-stop");
    container.lastChild.value = val;
  });
}