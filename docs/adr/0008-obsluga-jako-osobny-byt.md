# Obsługa strzelnicy to osobny byt, nie rola strzelca

Obsługa strzelnicy ma własną tabelę, własne logowanie i własne ciasteczko sesji, zamiast
być strzelcem z dodatkowym polem `role`. Wariant z rolą jest wygodniejszy dla kogoś, kto
jest jednocześnie pracownikiem i klientem — miałby jedno konto — ale ma cenę, której nie
chcemy płacić: każdy punkt API musiałby sprawdzać rolę, a pojedyncze przeoczenie otwiera
strzelcowi dostęp do danych osobowych cudzych rezerwacji.

Przy osobnym bycie żądanie strzelca nie ma jak trafić w uprawnienia obsługi, bo niesie
inne ciasteczko i trafia w inną tabelę. Sesja jednego rodzaju nie jest sesją drugiego —
nie z powodu sprawdzenia w kodzie, tylko dlatego, że to inna rzecz.

## Konsekwencje

- Kto jest i pracownikiem, i strzelcem, ma dwa konta. Uznajemy to za akceptowalne:
  dotyczy nielicznych, a alternatywa dotyczy bezpieczeństwa wszystkich.
- Obsługa nie może rezerwować „jako obsługa". Rezerwacja w imieniu klienta z telefonu to
  osobna funkcja, której świadomie nie ma.
- Konto obsługi należy do dokładnie jednej strzelnicy. Sieć kilku obiektów wymagałaby
  osobnego konta na obiekt — również świadomie, bo model najemcy zakłada jedną strzelnicę
  jako granicę wszystkiego (ADR 0001).
- Żadna operacja panelu nie przyjmuje identyfikatora strzelnicy z żądania: wynika on
  z zalogowanej obsługi. Nie ma argumentu, którym dałoby się sięgnąć do cudzych danych.
