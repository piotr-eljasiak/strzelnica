# Rezerwujemy całą oś w slotach godzinnych

Jednostką rezerwacji jest cała oś przez pełną godzinę, a dłuższy pobyt to kilka sąsiadujących
slotów w jednej rezerwacji. Odrzuciliśmy dowolne przedziały czasu (start co 15 minut, dowolna
długość), bo wymagają kontroli nakładania się zakresów i zostawiają w grafiku luki, których nikt
nie kupi. Odrzuciliśmy też rezerwowanie pojedynczych stanowisk na osi: przydział stanowisk jest
wewnętrzną sprawą strzelnicy, a wprowadzenie ich do modelu wymusza kontrolę pojemności w każdym
zapytaniu o dostępność.

## Konsekwencje

Grupa potrzebująca osi na wyłączność po prostu rezerwuje wszystkie sloty w danym czasie —
wyłączność wynika z modelu, nie jest osobną funkcją.
