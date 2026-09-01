# Widget jest iframe'em, ale rezerwację domyka się poza nim

Strzelnica osadza kalendarz na własnej stronie przez `<iframe>`, co czyni go kontekstem
third-party. Przeglądarki blokują tam ciasteczka i pamięć sesji, więc logowanie wewnątrz widgetu
albo nie zadziała, albo będzie gubić sesję przy każdym odświeżeniu. Widget pozostaje więc
anonimowy i tylko do przeglądania dostępności, a kliknięcie „Rezerwuję" przenosi strzelca
na stronę aplikacji (nawigacja całego okna, nie ramki), gdzie loguje się i potwierdza rezerwację.

## Odrzucone warianty

Logowanie w widgecie przez okno pop-up i przekazanie sesji przez `postMessage` — działa, ale
zależy od polityki ciasteczek, której nie kontrolujemy, i psuje się, gdy odnośnik logowania
otworzy się w innej karcie.
