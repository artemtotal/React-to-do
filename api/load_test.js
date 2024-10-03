import http from 'k6/http';
import { sleep, check } from 'k6';

// Konfiguration für den Lasttest
export const options = {
  vus: 50, // Anzahl der virtuellen Benutzer
  duration: '30s', // Testdauer
};

export default function () {
  const res = http.get('http://localhost:5001/todos'); // URL deiner Express-Anwendung
  
  // Überprüfen des Statuscodes und der Antwort
  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1); // Warte 1 Sekunde zwischen den Anfragen
}
