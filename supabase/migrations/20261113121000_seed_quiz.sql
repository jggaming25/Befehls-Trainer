-- ============================================================================
-- Befehlstrainer · Startfragen für das Quiz
-- Inhalte aus dem DVN-Betriebsregelwerk (Module DVN.1001–DVN.1005) sowie
-- zwei Befehlserstellungs-Aufgaben. Admins können alles jederzeit ändern.
-- ============================================================================

do $$
begin
  if not exists (select 1 from public.quiz_questions) then
    insert into public.quiz_questions
      (position, category, type, prompt, help, points, options, reference_answer, scenario, command_nr)
    values
    (
      10, 'regelwerk', 'multiple_choice',
      'Welche Richtlinie ist nach dem DVN-Betriebsregelwerk verbindlich anzuwenden?',
      'Modul DVN.1001 – Allgemeine Grundsätze',
      2,
      '[{"id":"a","label":"Ril 301","correct":true},{"id":"b","label":"Ril 408","correct":false},{"id":"c","label":"Ril 481","correct":false},{"id":"d","label":"Ril 915","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      20, 'regelwerk', 'multiple_choice',
      'Wann dürfen Signale auf Hp0 zurückgestellt werden?',
      'Modul DVN.1004 – Stellwerke & Stellpulte',
      2,
      '[{"id":"a","label":"Nur bei einem triftigen Grund; eine Fehlleitung zählt nicht dazu","correct":true},{"id":"b","label":"Immer, wenn der Fahrdienstleiter es für sinnvoll hält","correct":false},{"id":"c","label":"Nur nach Zustimmung der Transportleitung","correct":false},{"id":"d","label":"Niemals, Hp0 wird ausschließlich automatisch gestellt","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      30, 'regelwerk', 'multiple_choice',
      'Was gilt für die Nutzung des Blockwerks?',
      'Modul DVN.1005 – Blockwerk',
      2,
      '[{"id":"a","label":"Die Nutzung ist verpflichtend; es besteht keine Wahlmöglichkeit","correct":true},{"id":"b","label":"Die Nutzung ist optional, wenn der Zugfunk funktioniert","correct":false},{"id":"c","label":"Das Blockwerk wird nur bei Störungen verwendet","correct":false},{"id":"d","label":"Nur der Triebfahrzeugführer bedient das Blockwerk","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      40, 'regelwerk', 'multiple_choice',
      'Wann ist zum nächsten Stellwerk vorzublocken?',
      'Modul DVN.1005 – Blockwerk',
      2,
      '[{"id":"a","label":"Sobald der Zug im letzten Bahnhof vor dem neuen Stellwerksabschnitt steht","correct":true},{"id":"b","label":"Erst wenn der Zug das erste Signal des neuen Bereichs passiert hat","correct":false},{"id":"c","label":"Bereits beim Aufgleisen des Zuges am Startbahnhof","correct":false},{"id":"d","label":"Nur auf ausdrückliche Anweisung der Disposition","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      50, 'regelwerk', 'multiple_choice',
      'Wann ist zurückzublocken?',
      'Modul DVN.1005 – Blockwerk',
      2,
      '[{"id":"a","label":"Sobald der Zug das erste Signal des neuen Stellwerksbereichs vollständig passiert hat","correct":true},{"id":"b","label":"Sobald der Zug den Bahnhof verlassen hat","correct":false},{"id":"c","label":"Erst nach der Ankunft am Zielbahnhof","correct":false},{"id":"d","label":"Nach jedem Halt des Zuges","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      60, 'regelwerk', 'multiple_choice',
      'Ab welcher Verspätung muss zusätzlich ein Verspätungsgrund hinterlegt werden?',
      'Modul DVN.1003 – FIS-Systeme',
      2,
      '[{"id":"a","label":"Ab 5 Minuten","correct":true},{"id":"b","label":"Ab 1 Minute","correct":false},{"id":"c","label":"Ab 10 Minuten","correct":false},{"id":"d","label":"Erst ab 20 Minuten","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      70, 'regelwerk', 'multiple_choice',
      'Welcher Bahnübergang im Stellwerk STB ist manuell zu öffnen?',
      'Modul DVN.1004 – Stellwerke & Stellpulte, Abschnitt STB',
      2,
      '[{"id":"a","label":"Der Bahnübergang in STB","correct":true},{"id":"b","label":"Beide Bahnübergänge bei Hungen","correct":false},{"id":"c","label":"Es gibt in STB keinen Bahnübergang","correct":false},{"id":"d","label":"Alle Bahnübergänge werden automatisch geöffnet","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      80, 'regelwerk', 'multiple_choice',
      'Wann dürfen Fahrstraßen zurückgenommen werden?',
      'Modul DVN.1001 – Allgemeine Grundsätze',
      2,
      '[{"id":"a","label":"Wenn der Zug rechtzeitig vor dem Signal zum Halten kommen kann oder eine Betriebsgefahr besteht","correct":true},{"id":"b","label":"Immer, wenn ein Zug Verspätung hat","correct":false},{"id":"c","label":"Nur nach Freigabe durch den Triebfahrzeugführer","correct":false},{"id":"d","label":"Nur bei geöffnetem Bahnübergang","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      90, 'regelwerk', 'multiple_choice',
      'Wer ist die erste Anlaufstelle bei Fehlern, Problemen oder Komplikationen im Zuglauf?',
      'Modul DVN.1002 – Verbindlichkeit',
      2,
      '[{"id":"a","label":"Die Transportleitung","correct":true},{"id":"b","label":"Der nächste Triebfahrzeugführer","correct":false},{"id":"c","label":"Der Roblox-Support","correct":false},{"id":"d","label":"Die Betriebsleitung des EVU","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      100, 'regelwerk', 'multiple_choice',
      'Wann sind mündliche Befehle zulässig?',
      'Modul DVN.1001 und DVN.1005 – Befehle',
      2,
      '[{"id":"a","label":"Nur auf Anordnung eines Supervisors, der Disposition oder eines HR","correct":true},{"id":"b","label":"Immer, wenn der Zugfunk gestört ist","correct":false},{"id":"c","label":"Wenn der Fahrdienstleiter allein im Stellwerk ist","correct":false},{"id":"d","label":"Mündliche Befehle sind grundsätzlich verboten","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      110, 'allgemein', 'multiple_choice',
      'Was gilt für die Prioritäten der Zuggattungen?',
      'Allgemeine Betriebsregeln',
      2,
      '[{"id":"a","label":"Die Prioritäten von S-Bahn, RB, RE, IC und ICE sind eigenverantwortlich zu beachten","correct":true},{"id":"b","label":"Nur ICE-Züge haben eine Priorität","correct":false},{"id":"c","label":"Die Prioritäten werden ausschließlich von der Disposition vergeben","correct":false},{"id":"d","label":"S-Bahnen haben immer Vorrang vor allen anderen Zügen","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      120, 'allgemein', 'multiple_choice',
      'Was gilt für den Fahrdienstleiter während eines laufenden Befehls?',
      'Modul DVN.1001 – Allgemeine Grundsätze',
      2,
      '[{"id":"a","label":"Er darf das Stellwerk nicht verlassen; ein Stellwerkswechsel wartet, bis der Befehl abgeschlossen ist","correct":true},{"id":"b","label":"Er darf das Stellwerk jederzeit verlassen, wenn der Zug steht","correct":false},{"id":"c","label":"Er muss den Befehl sofort abbrechen, wenn ein anderer Zug kommt","correct":false},{"id":"d","label":"Er darf das Stellwerk nur mit Zustimmung des Triebfahrzeugführers verlassen","correct":false}]'::jsonb,
      null, '{}'::jsonb, null
    ),
    (
      130, 'regelwerk', 'short',
      'Was prüft der Fahrdienstleiter beim Ausfüllen eines schriftlichen Befehls?',
      'Modul DVN.1005 – Befehle',
      5,
      '[]'::jsonb,
      'Er prüft sowohl die eigenen Angaben als auch die Standortbestätigung des Triebfahrzeugführers. Der Befehl muss vollständig ausgefüllt sein; bei unzureichenden oder fehlenden Angaben können Maßnahmen ergriffen werden.',
      '{}'::jsonb,
      null
    ),
    (
      140, 'regelwerk', 'long',
      'Ein fehlerhaftes Stellwerk beeinträchtigt den Fahrbetrieb erheblich. Wie ist zu handeln?',
      'Modul DVN.1001 – Allgemeine Grundsätze',
      8,
      '[]'::jsonb,
      'Bei erheblicher Beeinträchtigung des Fahrbetriebs ist der Fehler unverzüglich der Disposition zu melden; diese veranlasst weitere Maßnahmen. Bei einem Fehler ohne Beeinträchtigung wird er im dafür vorgesehenen Discord-Kanal gemeldet. Bug-Abusing ist untersagt.',
      '{}'::jsonb,
      null
    ),
    (
      150, 'befehl', 'command',
      'Erstelle den passenden Befehl für die folgende Situation.',
      'Wähle den Befehl, fülle die Angaben aus und kreuze die erforderlichen Zusatzmaßnahmen an.',
      10,
      '[]'::jsonb,
      'Ein Halt zeigendes oder gestörtes Signal wird mit Befehl 1 überfahren. Signal und Zugmeldestelle müssen eindeutig benannt werden. Die Befreiung vom Fahren auf Sicht (×25) darf nur angekreuzt werden, wenn der Block nachweislich frei ist – hier ist das der Fall.',
      '{"command":"1","title":"Halt zeigendes Einfahrsignal","subtitle":"Bf Musterstadt · Esig 60A","train":"RE 4711","time":"08:12","facts":["Hp0 am Esig 60A","Signalstörung bestätigt","Block bis ASig 62B geprüft"],"situation":"Der Regionalexpress RE 4711 steht vor dem Einfahrsignal 60A des Bahnhofs Musterstadt. Das Signal zeigt Hp0; die Signalstörung ist durch den Fahrdienstleiter bestätigt. Der Block bis zum Ausfahrsignal 62B wurde geprüft und ist frei. Der Fahrdienstleiter erteilt die Vorbeifahrt und befreit den Triebfahrzeugführer vom Fahren auf Sicht.","task":"Stelle den passenden Befehl aus: Vorbeifahrt am Halt zeigenden Signal 60A, Weiterfahrt bis zum Ausfahrsignal 62B, Befreiung vom Fahren auf Sicht.","field_points":{"signal":{"correct":"Esig 60A","points":2},"stelle":{"correct":"Musterstadt","points":1},"bis":{"correct":"ASig 62B","points":1}},"measure_points":{"sicht":{"correct":true,"points":2}},"explanation":"Ein Halt zeigendes oder gestörtes Signal wird mit Befehl 1 überfahren. Signal und Zugmeldestelle müssen eindeutig benannt werden. Die Befreiung vom Fahren auf Sicht (×25) darf nur angekreuzt werden, wenn der Block nachweislich frei ist – hier ist das der Fall.","scene":{"track":"single","train":{"x":250,"label":"RE 4711","dir":1},"signals":[{"x":590,"label":"60A","aspect":"halt","km":"km 8,2","name":"Esig 60A"},{"x":865,"label":"62B","aspect":"langsam","km":"km 8,9","name":"ASig 62B"}],"platform":{"x":770,"name":"Musterstadt"},"callouts":[{"x":78,"y":62,"text":"Esig 60A zeigt Hp0","sub":"Halt · Signalstörung bestätigt","tone":"red","to":[590,250]},{"x":690,"y":150,"text":"Weiterfahrt bis 62B","sub":"Block geprüft und frei","tone":"green","to":[865,280]}],"badge":"Befehlsstelle Musterstadt · 08:12"}}'::jsonb,
      '1'
    ),
    (
      160, 'befehl', 'command',
      'Erstelle den passenden Befehl für die folgende Situation.',
      'Wähle den Befehl, fülle die Angaben aus und kreuze die erforderlichen Zusatzmaßnahmen an.',
      10,
      '[]'::jsonb,
      'Mit Befehl 5 wird eine Geschwindigkeitsbegrenzung angeordnet. Entscheidend sind der genaue Gültigkeitsbereich (von Signal 60A bis Signal 70A) und der Grund nach dem Grundkatalog – hier Nummer 29 „Mängel am Oberbau“.',
      '{"command":"5","title":"Geschwindigkeitsbegrenzung nach Oberbaumangel","subtitle":"Musterstadt – Talheim","train":"IC 2045","time":"09:40","facts":["Oberbaumangel","50 km/h","Esig 60A bis Esig 70A"],"situation":"Zwischen dem Einfahrsignal 60A in Musterstadt und dem Einfahrsignal 70A in Talheim wurde bei einer Streckenprüfung ein Oberbaumangel festgestellt. Der Fahrdienstleiter ordnet für den Abschnitt eine Höchstgeschwindigkeit von 50 km/h an. Langsamfahrsignale sind nicht aufgestellt; die Einschränkung gilt bis zum Esig 70A.","task":"Stelle den Befehl mit Höchstgeschwindigkeit, Gültigkeitsbereich und Grund aus.","field_points":{"speed":{"correct":"50 km/h","points":2},"von":{"correct":"Esig 60A","points":1},"bis":{"correct":"Esig 70A","points":1},"grund":{"correct":"29 – Mängel am Oberbau","points":2}},"measure_points":{},"explanation":"Mit Befehl 5 wird eine Geschwindigkeitsbegrenzung angeordnet. Entscheidend sind der genaue Gültigkeitsbereich (von Signal 60A bis Signal 70A) und der Grund nach dem Grundkatalog – hier Nummer 29 „Mängel am Oberbau“.","scene":{"track":"single","electrified":true,"train":{"x":205,"label":"IC 2045","dir":1},"signals":[{"x":120,"label":"60A","aspect":"fahrt","km":"km 8,2","name":"Esig 60A"},{"x":845,"label":"70A","aspect":"fahrt","km":"km 14,8","name":"Esig 70A"}],"speedBoard":{"x":500,"speed":"50"},"callouts":[{"x":320,"y":68,"text":"Höchstgeschwindigkeit 50 km/h","sub":"Grund 29 · Mängel am Oberbau","tone":"amber","to":[500,268]},{"x":640,"y":176,"text":"Gültig bis Esig 70A","sub":"Talheim · km 14,8","tone":"blue","to":[845,300]}],"badge":"Streckenprüfung · Oberbaumangel"}}'::jsonb,
      '5'
    );
  end if;
end $$;
