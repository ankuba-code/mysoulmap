const NAV = {
  de: [
    { to: "/impressum", label: "Impressum" },
    { to: "/disclaimer", label: "Nutzungsbedingungen" },
    { to: "/datenschutz", label: "Datenschutz" },
  ],
  en: [
    { to: "/impressum", label: "Imprint" },
    { to: "/disclaimer", label: "Terms and Conditions" },
    { to: "/datenschutz", label: "Privacy" },
  ],
  es: [
    { to: "/impressum", label: "Aviso legal" },
    { to: "/disclaimer", label: "Términos y condiciones" },
    { to: "/datenschutz", label: "Privacidad" },
  ],
  ru: [
    { to: "/impressum", label: "Выходные данные" },
    { to: "/disclaimer", label: "Условия использования" },
    { to: "/datenschutz", label: "Конфиденциальность" },
  ],
};

const PAGES = {
  de: {
    impressum: {
      title: "Impressum",
      sections: [
        {
          heading: "Anbieter",
          paragraphs: [
            "SoulMap ist ein Angebot von Andre Kubasch und unter https://app.mithertz.online erreichbar.",
            "E-Mail: intouch@mithertz.online",
            "Eine ladungsfähige Postanschrift nach § 5 DDG ist hier noch nicht eingetragen. Eine Telefonnummer wird nicht angegeben.",
          ],
        },
        {
          heading: "Inhalt",
          paragraphs: [
            "SoulMap zeigt nach einem kurzen Ritual Orte aus einem kuratierten Atlas und einen Reiseassistenten. Der Assistent ist eine künstliche Intelligenz. Der Hinweis dazu erscheint auf der Ergebnisseite, sobald sie geladen ist.",
            "Die Vorschläge sind unverbindlich. Sie sind keine Reise-, Rechts-, Gesundheits- oder Sicherheitsberatung.",
          ],
        },
        {
          heading: "Werbung",
          paragraphs: [
            "„Unterkunft suchen“ ist als Anzeige gekennzeichnet und führt zu Booking.com. Ein Vertrag entsteht nur mit dem jeweiligen Anbieter, nicht mit SoulMap.",
          ],
        },
      ],
    },
    disclaimer: {
      title: "Nutzungsbedingungen",
      paragraphs: [
        "SoulMap bietet ein Ritual und unverbindliche Ortsimpulse. Das ist keine Reise-, Rechts-, Gesundheits- oder Sicherheitsberatung.",
        "Antworten des Reiseassistenten erzeugt eine KI. Angaben zu Orten, Anreise, Unterkünften, Aktivitäten und Preisen können unvollständig, veraltet oder unzutreffend sein. Dafür wird keine Gewähr übernommen.",
        "„Unterkunft suchen“ ist eine gekennzeichnete Anzeige und führt zu Booking.com. Ein Vertrag entsteht ausschließlich mit dem jeweiligen Anbieter, nicht mit SoulMap.",
        "Die Nutzung erfolgt auf eigene Verantwortung. Reisehinweise, Einreisebestimmungen und die Verhältnisse vor Ort prüfst du selbst.",
        "IP-Adressen werden höchstens für eine sechsmonatige Geolokalisations-Statistik benötigt, um die Anwendung benutzerfreundlich auszubauen.",
      ],
    },
    privacy: {
      title: "Datenschutz",
      sections: [
        {
          heading: "Verantwortlicher",
          paragraphs: [
            "Verantwortlich für die Verarbeitung ist Andre Kubasch, E-Mail intouch@mithertz.online.",
          ],
        },
        {
          heading: "Was im Browser bleibt",
          paragraphs: [
            "Es gibt kein Nutzerkonto und kein Login. Ritual, Sprache und die Ergebnisseite liegen im sessionStorage dieses Browsers. Sie verlassen das Gerät erst, wenn eine Funktion sie ausdrücklich mitsendet, und entfallen, wenn der Tab geschlossen oder das Ritual neu begonnen wird.",
            "Die öffentliche Seite setzt keine Cookies.",
          ],
        },
        {
          heading: "Reiseassistent",
          paragraphs: [
            "Wenn du den Reiseassistenten nutzt, werden deine Nachricht und der dafür nötige Gesprächsverlauf an OpenAI übermittelt, um die Antwort zu erzeugen. OpenAI verarbeitet diese Inhalte in den USA. Dieselben Inhalte können zur technischen Überwachung der KI-Anbindung an Langfuse übermittelt werden.",
            "Die letzte Nutzernachricht wird zusätzlich gekürzt auf 500 Zeichen in der eigenen Nutzungsstatistik gespeichert. Assistentenantworten und der übrige Verlauf werden dort nicht gespeichert. Zweck sind Missbrauchsschutz, das Token-Limit und der interne Monatsreport. Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe f DSGVO (berechtigtes Interesse). Diese Speicherung endet 6 Monate nach dem Ereignis.",
          ],
        },
        {
          heading: "Nutzungsstatistik und Standort",
          paragraphs: [
            "IP-Adresse, der daraus lokal abgeleitete Ländercode und die primäre Sprache des Browsers, zum Beispiel de-DE, werden in der Nutzungsstatistik gespeichert. Die Länderermittlung nutzt GeoLite2-Daten von MaxMind auf dem eigenen Server. Die IP-Adresse wird dafür nicht an MaxMind gesendet. Auf der Ergebnisseite kann daraus ein ungefährer Standort für die Karte entstehen.",
            "Zweck sind Betrieb, Missbrauchsschutz und technisches Monitoring. Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe f DSGVO. Die Speicherung endet 6 Monate nach dem Ereignis.",
            "Ein Ortsname kann zur Positionierung auf der Karte an den Geocoding-Dienst von Open-Meteo gesendet werden. Die IP-Adresse der Nutzerin oder des Nutzers wird dabei nicht mitgeschickt.",
          ],
        },
        {
          heading: "Booking.com",
          paragraphs: [
            "Ein Klick auf „Unterkunft suchen“ ist eine Anzeige und leitet zu Booking.com weiter. Ab dort verarbeitet Booking.com die Anfrage nach eigenen Regeln.",
          ],
        },
        {
          heading: "Deine Rechte",
          paragraphs: [
            "Du kannst Auskunft, Berichtigung, Löschung und Einschränkung verlangen und der Verarbeitung auf Grundlage des berechtigten Interesses widersprechen. Dafür genügt eine E-Mail an die oben genannte Adresse. Außerdem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.",
          ],
        },
        {
          heading: "Kennzeichnung der KI",
          paragraphs: [
            "Auf der Ergebnisseite kannst du mit einer KI interagieren. Der Hinweis erscheint, nachdem die Seite geladen ist, und zusätzlich im Gespräch.",
          ],
        },
      ],
    },
  },
  en: {
    impressum: {
      title: "Imprint",
      sections: [
        {
          heading: "Provider",
          paragraphs: [
            "SoulMap is offered by Andre Kubasch and is available at https://app.mithertz.online.",
            "Email: intouch@mithertz.online",
            "A postal address for service under § 5 DDG is not listed here yet. No telephone number is given.",
          ],
        },
        {
          heading: "Content",
          paragraphs: [
            "After a short ritual, SoulMap shows places from a curated atlas and a travel assistant. The assistant is an artificial intelligence. The notice appears on the results page once it has loaded.",
            "The suggestions are non-binding. They are not travel, legal, health or safety advice.",
          ],
        },
        {
          heading: "Advertising",
          paragraphs: [
            "“Find a stay” is labelled as an advertisement and leads to Booking.com. Any contract is formed only with that provider, not with SoulMap.",
          ],
        },
      ],
    },
    disclaimer: {
      title: "Terms and Conditions",
      paragraphs: [
        "SoulMap offers a ritual and non-binding place suggestions. It is not travel, legal, health or safety advice.",
        "Replies from the travel assistant are produced by an AI. Details about places, getting there, lodging, activities and prices may be incomplete, out of date or wrong. No warranty is given.",
        "“Find a stay” is a labelled advertisement and leads to Booking.com. Any contract is formed only with that provider, not with SoulMap.",
        "You use the service at your own responsibility. Check travel advice, entry rules and local conditions yourself.",
        "IP addresses are needed for at most a six-month geolocation statistic, so the application can be developed in a more user-friendly way.",
      ],
    },
    privacy: {
      title: "Privacy",
      sections: [
        {
          heading: "Controller",
          paragraphs: ["The controller is Andre Kubasch, email intouch@mithertz.online."],
        },
        {
          heading: "What stays in the browser",
          paragraphs: [
            "There is no user account and no login. The ritual, the language and the results page stay in this browser’s session storage. They leave the device only when a function explicitly sends them, and they disappear when the tab is closed or the ritual is started again.",
            "The public site does not set cookies.",
          ],
        },
        {
          heading: "Travel assistant",
          paragraphs: [
            "When you use the travel assistant, your message and the conversation needed for the reply are sent to OpenAI in order to produce the answer. OpenAI processes this content in the United States. The same content can be sent to Langfuse to monitor the AI connection technically.",
            "The latest user message is also stored, shortened to 500 characters, in SoulMap’s own usage statistics. Assistant replies and the rest of the thread are not stored there. The purpose is abuse prevention, the token limit and the internal monthly report. The legal basis is Article 6(1)(f) GDPR (legitimate interest). This storage ends 6 months after the event.",
          ],
        },
        {
          heading: "Usage statistics and location",
          paragraphs: [
            "The IP address, the country code derived from it locally, and the primary language of the browser, for example de-DE, are stored in the usage statistics. Country lookup uses MaxMind GeoLite2 data on SoulMap’s own server. The IP address is not sent to MaxMind for this. On the results page an approximate location for the map can be derived from it.",
            "The purpose is operation, abuse prevention and technical monitoring. The legal basis is Article 6(1)(f) GDPR. Storage ends 6 months after the event.",
            "A place name can be sent to the Open-Meteo geocoding service in order to position it on the map. The visitor’s IP address is not included.",
          ],
        },
        {
          heading: "Booking.com",
          paragraphs: [
            "A click on “Find a stay” is an advertisement and continues to Booking.com. From there, Booking.com processes the request under its own rules.",
          ],
        },
        {
          heading: "Your rights",
          paragraphs: [
            "You can request access, rectification, erasure and restriction, and you can object to processing based on legitimate interest. An email to the address above is enough. You also have the right to lodge a complaint with a data protection authority.",
          ],
        },
        {
          heading: "AI labelling",
          paragraphs: [
            "On the results page you can interact with an AI. The notice appears after the page has loaded, and again in the conversation.",
          ],
        },
      ],
    },
  },
  es: {
    impressum: {
      title: "Aviso legal",
      sections: [
        {
          heading: "Prestador",
          paragraphs: [
            "SoulMap es una oferta de Andre Kubasch y está disponible en https://app.mithertz.online.",
            "Correo: intouch@mithertz.online",
            "Aquí todavía no figura una dirección postal hábil para notificaciones según el § 5 DDG. No se indica un teléfono.",
          ],
        },
        {
          heading: "Contenido",
          paragraphs: [
            "Tras un ritual breve, SoulMap muestra lugares de un atlas seleccionado y un asistente de viaje. El asistente es una inteligencia artificial. El aviso aparece en la página de resultados en cuanto ha cargado.",
            "Las sugerencias no son vinculantes. No son asesoramiento de viaje, jurídico, sanitario ni de seguridad.",
          ],
        },
        {
          heading: "Publicidad",
          paragraphs: [
            "«Buscar alojamiento» está identificado como anuncio y lleva a Booking.com. El contrato se celebra solo con el proveedor, no con SoulMap.",
          ],
        },
      ],
    },
    disclaimer: {
      title: "Términos y condiciones",
      paragraphs: [
        "SoulMap ofrece un ritual y sugerencias de lugares sin compromiso. No es asesoramiento de viaje, jurídico, sanitario ni de seguridad.",
        "Las respuestas del asistente de viaje las genera una IA. Los datos sobre lugares, cómo llegar, alojamiento, actividades y precios pueden estar incompletos, desactualizados o ser incorrectos. No hay garantía.",
        "«Buscar alojamiento» es un anuncio identificado y lleva a Booking.com. El contrato se celebra solo con el proveedor, no con SoulMap.",
        "El uso es bajo tu propia responsabilidad. Comprueba los avisos de viaje, los requisitos de entrada y las condiciones locales.",
        "Las direcciones IP se necesitan como máximo durante seis meses para una estadística de geolocalización, con el fin de ampliar la aplicación de forma más fácil de usar.",
      ],
    },
    privacy: {
      title: "Privacidad",
      sections: [
        {
          heading: "Responsable",
          paragraphs: ["El responsable del tratamiento es Andre Kubasch, correo intouch@mithertz.online."],
        },
        {
          heading: "Qué permanece en el navegador",
          paragraphs: [
            "No hay cuenta de usuario ni inicio de sesión. El ritual, el idioma y la página de resultados permanecen en el sessionStorage de este navegador. Solo salen del dispositivo cuando una función los envía de forma expresa, y desaparecen al cerrar la pestaña o al empezar el ritual de nuevo.",
            "El sitio público no instala cookies.",
          ],
        },
        {
          heading: "Asistente de viaje",
          paragraphs: [
            "Si usas el asistente de viaje, tu mensaje y la conversación necesaria para la respuesta se envían a OpenAI para generarla. OpenAI trata esos contenidos en Estados Unidos. Los mismos contenidos pueden enviarse a Langfuse para la supervisión técnica de la conexión con la IA.",
            "Además se guarda el último mensaje de la persona usuaria, abreviado a 500 caracteres, en la estadística de uso propia. Las respuestas del asistente y el resto del hilo no se guardan allí. La finalidad es prevenir abusos, aplicar el límite de tokens y elaborar el informe mensual interno. La base jurídica es el artículo 6, apartado 1, letra f, del RGPD (interés legítimo). Este almacenamiento termina 6 meses después del evento.",
          ],
        },
        {
          heading: "Estadística de uso y ubicación",
          paragraphs: [
            "La dirección IP, el código de país derivado localmente y el idioma principal del navegador, por ejemplo de-DE, se guardan en la estadística de uso. El país se obtiene con datos GeoLite2 de MaxMind en el propio servidor. La dirección IP no se envía a MaxMind para ello. En la página de resultados puede calcularse una ubicación aproximada para el mapa.",
            "La finalidad es el funcionamiento, la prevención de abusos y la monitorización técnica. La base jurídica es el artículo 6, apartado 1, letra f, del RGPD. El almacenamiento termina 6 meses después del evento.",
            "Un nombre de lugar puede enviarse al servicio de geocodificación de Open-Meteo para situarlo en el mapa. La dirección IP de la persona visitante no se incluye.",
          ],
        },
        {
          heading: "Booking.com",
          paragraphs: [
            "Un clic en «Buscar alojamiento» es un anuncio y continúa en Booking.com. A partir de ahí, Booking.com trata la solicitud según sus propias reglas.",
          ],
        },
        {
          heading: "Tus derechos",
          paragraphs: [
            "Puedes solicitar acceso, rectificación, supresión y limitación, y oponerte al tratamiento basado en el interés legítimo. Basta un correo a la dirección indicada arriba. También tienes derecho a reclamar ante una autoridad de protección de datos.",
          ],
        },
        {
          heading: "Identificación de la IA",
          paragraphs: [
            "En la página de resultados puedes interactuar con una IA. El aviso aparece cuando la página ha cargado y, además, en la conversación.",
          ],
        },
      ],
    },
  },
  ru: {
    impressum: {
      title: "Выходные данные",
      sections: [
        {
          heading: "Оператор",
          paragraphs: [
            "SoulMap — предложение Andre Kubasch, сайт https://app.mithertz.online.",
            "Эл. почта: intouch@mithertz.online",
            "Почтовый адрес для официальных уведомлений по § 5 DDG здесь пока не указан. Телефон не указан.",
          ],
        },
        {
          heading: "Содержание",
          paragraphs: [
            "После короткого ритуала SoulMap показывает места из собранного атласа и помощника в пути. Помощник — это искусственный интеллект. Указание появляется на странице результатов, как только она загрузилась.",
            "Подсказки необязательны. Это не туристическая, юридическая, медицинская консультация и не консультация по безопасности.",
          ],
        },
        {
          heading: "Реклама",
          paragraphs: [
            "«Найти жильё» помечено как реклама и ведёт на Booking.com. Договор заключается только с соответствующим поставщиком, не с SoulMap.",
          ],
        },
      ],
    },
    disclaimer: {
      title: "Условия использования",
      paragraphs: [
        "SoulMap предлагает ритуал и необязательные подсказки мест. Это не туристическая, юридическая, медицинская или иная консультация по безопасности.",
        "Ответы ассистента путешествий создаёт ИИ. Сведения о местах, дороге, жилье, занятиях и ценах могут быть неполными, устаревшими или неверными. Гарантия не даётся.",
        "«Найти жильё» — помеченная реклама и ведёт на Booking.com. Договор заключается только с соответствующим поставщиком, не с SoulMap.",
        "Ты пользуешься сервисом на свою ответственность. Рекомендации для поездки, правила въезда и местные условия проверяй сам.",
        "IP-адреса нужны не дольше шести месяцев для статистики геолокации, чтобы развивать приложение так, чтобы им было удобнее пользоваться.",
      ],
    },
    privacy: {
      title: "Конфиденциальность",
      sections: [
        {
          heading: "Ответственный",
          paragraphs: ["Ответственный за обработку — Andre Kubasch, эл. почта intouch@mithertz.online."],
        },
        {
          heading: "Что остаётся в браузере",
          paragraphs: [
            "Учётной записи и входа нет. Ритуал, язык и страница результатов лежат в sessionStorage этого браузера. Они покидают устройство только тогда, когда функция явно их отправляет, и исчезают, когда вкладка закрыта или ритуал начат заново.",
            "Публичный сайт не ставит cookie.",
          ],
        },
        {
          heading: "Помощник в пути",
          paragraphs: [
            "Если ты пользуешься помощником, твоё сообщение и переписка, нужная для ответа, передаются в OpenAI, чтобы создать ответ. OpenAI обрабатывает эти данные в США. Те же данные могут передаваться в Langfuse для технического наблюдения за подключением к ИИ.",
            "Последнее сообщение пользователя дополнительно хранится в собственной статистике использования, сокращённое до 500 знаков. Ответы помощника и остальной ход разговора там не сохраняются. Цель — защита от злоупотреблений, лимит токенов и внутренний месячный отчёт. Правовое основание — статья 6 абзац 1 буква f GDPR (законный интерес). Это хранение заканчивается через 6 месяцев после события.",
          ],
        },
        {
          heading: "Статистика и местоположение",
          paragraphs: [
            "IP-адрес, полученный из него локально код страны и основной язык браузера, например de-DE, сохраняются в статистике использования. Страна определяется по данным GeoLite2 от MaxMind на собственном сервере. IP-адрес для этого в MaxMind не отправляется. На странице результатов из этого может получиться приблизительное место для карты.",
            "Цель — работа сервиса, защита от злоупотреблений и технический мониторинг. Правовое основание — статья 6 абзац 1 буква f GDPR. Хранение заканчивается через 6 месяцев после события.",
            "Название места может отправляться в геокодер Open-Meteo, чтобы поставить точку на карте. IP-адрес посетителя при этом не передаётся.",
          ],
        },
        {
          heading: "Booking.com",
          paragraphs: [
            "Нажатие «Найти жильё» — это реклама и переход на Booking.com. Дальше запрос обрабатывает Booking.com по своим правилам.",
          ],
        },
        {
          heading: "Твои права",
          paragraphs: [
            "Ты можешь запросить доступ, исправление, удаление и ограничение обработки и возразить против обработки на основании законного интереса. Достаточно письма на адрес выше. Также можно подать жалобу в надзорный орган по защите данных.",
          ],
        },
        {
          heading: "Обозначение ИИ",
          paragraphs: [
            "На странице результатов ты можешь взаимодействовать с ИИ. Указание появляется после загрузки страницы и дополнительно в разговоре.",
          ],
        },
      ],
    },
  },
};

export function legalNav(language) {
  return NAV[language] || NAV.de;
}

export function legalCopy(language) {
  return PAGES[language] || PAGES.de;
}

export function pageBlocks(page) {
  if (page.sections) {
    return page.sections;
  }
  return [{ paragraphs: page.paragraphs }];
}

export function pageText(page) {
  return pageBlocks(page)
    .flatMap((section) => section.paragraphs)
    .join(" ");
}
