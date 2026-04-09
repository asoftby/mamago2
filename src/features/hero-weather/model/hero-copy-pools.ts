export type CopyVariant = {
  id: string
  text: string
  weight?: number
  usesName?: boolean
  usesChildName?: boolean
}

export type HeroCopyPack = {
  microcopy: CopyVariant[]
  titles: CopyVariant[]
  subtitles: CopyVariant[]
}

export type HeroPersonaMode = "guest" | "self" | "child" | "family"

export type WeatherScenario =
  | "great_outdoor"
  | "good_outdoor"
  | "mixed_outdoor"
  | "rain_indoor"
  | "heavy_rain_indoor"
  | "windy_caution"
  | "cold_mixed"
  | "snow_indoor"
  | "hot_caution"
  | "unknown"

export const HERO_COPY_POOLS: Record<WeatherScenario, Record<HeroPersonaMode, HeroCopyPack>> = {
  great_outdoor: {
    guest: {
      microcopy: [
        { id: "great_guest_micro_1", text: "☀️ Сегодня отличный день для новых впечатлений" },
        { id: "great_guest_micro_2", text: "☀️ Погода прямо зовёт куда-нибудь выбраться" },
        { id: "great_guest_micro_3", text: "🌤 На улице очень приятно — можно устроить хороший день" },
        { id: "great_guest_micro_4", text: "☀️ Сегодня как раз та самая погода, когда хочется не сидеть дома" },
        { id: "great_guest_micro_5", text: "🌤 Хороший день, чтобы придумать что-то приятное" },
        { id: "great_guest_micro_6", text: "☀️ Солнышко светит — самое время для семейных приключений" },
        { id: "great_guest_micro_7", text: "🌤 Такая погода просто создана для прогулок с детьми" }
      ],
      titles: [
        { id: "great_guest_title_1", text: "Давай найдём идею для семьи" },
        { id: "great_guest_title_2", text: "Можно выбрать что-нибудь на сегодня" },
        { id: "great_guest_title_3", text: "Самое время придумать приятный план на день" },
        { id: "great_guest_title_4", text: "Посмотрим, куда можно сходить" },
        { id: "great_guest_title_5", text: "Хочется куда-нибудь выбраться — и это легко устроить" },
        { id: "great_guest_title_6", text: "Найдём что-то интересное для всей семьи" },
        { id: "great_guest_title_7", text: "Сегодня можно устроить отличный день" }
      ],
      subtitles: [
        { id: "great_guest_sub_1", text: "Собрала варианты в Минске, чтобы было проще решить, куда пойти сегодня" },
        { id: "great_guest_sub_2", text: "Подберём прогулки, занятия и места, где можно хорошо провести время" },
        { id: "great_guest_sub_3", text: "Уже есть идеи на сегодня — остаётся только выбрать" },
        { id: "great_guest_sub_4", text: "Смотри, что подойдёт для семейного выхода именно сегодня" },
        { id: "great_guest_sub_5", text: "Выбирай, сохраняй и собирай свой план без лишнего поиска" },
        { id: "great_guest_sub_6", text: "Здесь найдутся идеи для детей любого возраста и настроения" },
        { id: "great_guest_sub_7", text: "От парков до музеев — всё, что нужно для хорошего дня с семьёй" }
      ]
    },
    self: {
      microcopy: [
        { id: "great_self_micro_1", text: "☀️ Привет, {userName}! Сегодня отличная погода для планов", usesName: true },
        { id: "great_self_micro_2", text: "🌤 Хороший день, чтобы выбраться куда-нибудь" },
        { id: "great_self_micro_3", text: "☀️ Солнышко светит — можно придумать что-то приятное" },
        { id: "great_self_micro_4", text: "🌤 Погода располагает к семейным приключениям" },
        { id: "great_self_micro_5", text: "☀️ Такой день просто создан для прогулок с детьми" },
        { id: "great_self_micro_6", text: "🌤 На улице красота — время для новых впечатлений" },
        { id: "great_self_micro_7", text: "☀️ Отличный день, чтобы не сидеть дома" }
      ],
      titles: [
        { id: "great_self_title_1", text: "Что будем делать сегодня?" },
        { id: "great_self_title_2", text: "Найдём что-то интересное для семьи" },
        { id: "great_self_title_3", text: "Давай составим план на день" },
        { id: "great_self_title_4", text: "Посмотрим, куда можно сходить" },
        { id: "great_self_title_5", text: "Время для семейных приключений" },
        { id: "great_self_title_6", text: "Выберем что-нибудь приятное на сегодня" },
        { id: "great_self_title_7", text: "Устроим хороший день для всех" }
      ],
      subtitles: [
        { id: "great_self_sub_1", text: "Подобрала идеи, которые точно подойдут твоей семье" },
        { id: "great_self_sub_2", text: "Здесь есть всё — от прогулок до развлечений в помещении" },
        { id: "great_self_sub_3", text: "Выбирай по возрасту детей и своему настроению" },
        { id: "great_self_sub_4", text: "Сохраняй понравившиеся идеи и составляй свой план" },
        { id: "great_self_sub_5", text: "От активных игр до спокойных занятий — найдётся всё" },
        { id: "great_self_sub_6", text: "Каждая идея проверена другими родителями из Минска" },
        { id: "great_self_sub_7", text: "Просто выбери и иди — всё уже готово для хорошего дня" }
      ]
    },
    child: {
      microcopy: [
        { id: "great_child_micro_1", text: "☀️ Отличная погода для приключений с {childName}!" },
        { id: "great_child_micro_2", text: "🌤 Сегодня можно устроить {childName} отличный день" },
        { id: "great_child_micro_3", text: "☀️ Солнышко светит — самое время для прогулок" },
        { id: "great_child_micro_4", text: "🌤 Хороший день, чтобы показать {childName} что-то новое" },
        { id: "great_child_micro_5", text: "☀️ Погода зовёт на улицу — и это здорово!" },
        { id: "great_child_micro_6", text: "🌤 Такая погода создана для детских открытий" },
        { id: "great_child_micro_7", text: "☀️ На улице красота — время для семейных моментов" }
      ],
      titles: [
        { id: "great_child_title_1", text: "Куда пойдём с {childName}?" },
        { id: "great_child_title_2", text: "Найдём приключение для {childName}" },
        { id: "great_child_title_3", text: "Что покажем {childName} сегодня?" },
        { id: "great_child_title_4", text: "Выберем что-то интересное" },
        { id: "great_child_title_5", text: "Устроим {childName} отличный день" },
        { id: "great_child_title_6", text: "Время для новых впечатлений" },
        { id: "great_child_title_7", text: "Давай найдём идею на сегодня" }
      ],
      subtitles: [
        { id: "great_child_sub_1", text: "Собрала места и занятия, которые точно понравятся детям" },
        { id: "great_child_sub_2", text: "Здесь есть идеи для любого возраста и настроения {childName}" },
        { id: "great_child_sub_3", text: "От активных игр до творческих мастерских — выбирай по душе" },
        { id: "great_child_sub_4", text: "Каждое место проверено родителями и подходит для детей" },
        { id: "great_child_sub_5", text: "Сохраняй понравившиеся идеи и планируй день без стресса" },
        { id: "great_child_sub_6", text: "Всё рядом, всё доступно — просто выбери и идите веселиться" },
        { id: "great_child_sub_7", text: "Пусть {childName} сам выберет, что ему больше нравится" }
      ]
    },
    family: {
      microcopy: [
        { id: "great_family_micro_1", text: "☀️ Отличный день для всей семьи!" },
        { id: "great_family_micro_2", text: "🌤 Погода располагает к семейным приключениям" },
        { id: "great_family_micro_3", text: "☀️ Солнышко светит — время собираться и идти гулять" },
        { id: "great_family_micro_4", text: "🌤 Такая погода создана для семейного времени" },
        { id: "great_family_micro_5", text: "☀️ Хороший день, чтобы устроить праздник для всех" },
        { id: "great_family_micro_6", text: "🌤 На улице красота — самое время для общих впечатлений" },
        { id: "great_family_micro_7", text: "☀️ Отличная погода для создания семейных воспоминаний" }
      ],
      titles: [
        { id: "great_family_title_1", text: "Куда пойдём всей семьёй?" },
        { id: "great_family_title_2", text: "Найдём приключение для всех" },
        { id: "great_family_title_3", text: "Что будем делать вместе?" },
        { id: "great_family_title_4", text: "Выберем занятие для всей семьи" },
        { id: "great_family_title_5", text: "Устроим день, который запомнится всем" },
        { id: "great_family_title_6", text: "Время для семейных открытий" },
        { id: "great_family_title_7", text: "Давай найдём что-то для всех возрастов" }
      ],
      subtitles: [
        { id: "great_family_sub_1", text: "Здесь есть места, где будет интересно и детям, и взрослым" },
        { id: "great_family_sub_2", text: "От парков до музеев — выбирай то, что подойдёт всей семье" },
        { id: "great_family_sub_3", text: "Каждая идея учитывает потребности разных возрастов" },
        { id: "great_family_sub_4", text: "Сохраняй варианты и планируй день без компромиссов" },
        { id: "great_family_sub_5", text: "Всё проверено семьями из Минска — точно будет хорошо" },
        { id: "great_family_sub_6", text: "Выбирай по настроению и возможностям — найдётся для всех" },
        { id: "great_family_sub_7", text: "Пусть каждый найдёт что-то по душе в общем семейном дне" }
      ]
    }
  },
  good_outdoor: {
    guest: {
      microcopy: [
        { id: "good_guest_micro_1", text: "🌤 Неплохая погода для семейных планов" },
        { id: "good_guest_micro_2", text: "☀️ Можно выбраться куда-нибудь на свежий воздух" },
        { id: "good_guest_micro_3", text: "🌤 Сегодня подходящий день для прогулок" },
        { id: "good_guest_micro_4", text: "☀️ Погода позволяет устроить приятный день" },
        { id: "good_guest_micro_5", text: "🌤 Хорошее время для семейного досуга" },
        { id: "good_guest_micro_6", text: "☀️ На улице вполне комфортно для детей" },
        { id: "good_guest_micro_7", text: "🌤 Можно совместить и улицу, и помещения" }
      ],
      titles: [
        { id: "good_guest_title_1", text: "Посмотрим, что можно придумать" },
        { id: "good_guest_title_2", text: "Найдём подходящие варианты" },
        { id: "good_guest_title_3", text: "Выберем что-то приятное на день" },
        { id: "good_guest_title_4", text: "Можно устроить хороший семейный день" },
        { id: "good_guest_title_5", text: "Давай подберём идеи для семьи" },
        { id: "good_guest_title_6", text: "Что-нибудь интересное точно найдётся" },
        { id: "good_guest_title_7", text: "Составим план на сегодня" }
      ],
      subtitles: [
        { id: "good_guest_sub_1", text: "Есть варианты и для улицы, и для помещений — выбирай по настроению" },
        { id: "good_guest_sub_2", text: "Подберём занятия, которые подойдут для любой погоды" },
        { id: "good_guest_sub_3", text: "Здесь найдутся идеи на любой вкус и возраст" },
        { id: "good_guest_sub_4", text: "Сохраняй понравившиеся места и планируй без спешки" },
        { id: "good_guest_sub_5", text: "От активных прогулок до уютных кафе — всё в одном месте" },
        { id: "good_guest_sub_6", text: "Каждая идея проверена и подходит для семей с детьми" },
        { id: "good_guest_sub_7", text: "Выбирай то, что точно принесёт радость всей семье" }
      ]
    },
    self: {
      microcopy: [
        { id: "good_self_micro_1", text: "🌤 Неплохой день для семейных планов" },
        { id: "good_self_micro_2", text: "☀️ Можно выбрать что-то и на улице, и в помещении" },
        { id: "good_self_micro_3", text: "🌤 Погода позволяет быть гибкими в планах" },
        { id: "good_self_micro_4", text: "☀️ Хорошее время для разнообразного досуга" },
        { id: "good_self_micro_5", text: "🌤 Сегодня можно совместить разные активности" },
        { id: "good_self_micro_6", text: "☀️ Подходящий день для семейных открытий" },
        { id: "good_self_micro_7", text: "🌤 Время выбрать что-то по душе" }
      ],
      titles: [
        { id: "good_self_title_1", text: "Что выберем на сегодня?" },
        { id: "good_self_title_2", text: "Найдём что-то подходящее для семьи" },
        { id: "good_self_title_3", text: "Посмотрим варианты на день" },
        { id: "good_self_title_4", text: "Можно устроить приятное время" },
        { id: "good_self_title_5", text: "Выберем занятие по настроению" },
        { id: "good_self_title_6", text: "Давай составим гибкий план" },
        { id: "good_self_title_7", text: "Найдётся что-то интересное для всех" }
      ],
      subtitles: [
        { id: "good_self_sub_1", text: "Подобрала варианты на разные случаи — выбирай по ситуации" },
        { id: "good_self_sub_2", text: "Здесь есть и активные, и спокойные занятия для твоей семьи" },
        { id: "good_self_sub_3", text: "Можно легко менять планы в зависимости от настроения детей" },
        { id: "good_self_sub_4", text: "Сохраняй несколько вариантов — пригодится для запасного плана" },
        { id: "good_self_sub_5", text: "От прогулок до мастер-классов — всё учтено и проверено" },
        { id: "good_self_sub_6", text: "Каждая идея подходит для семей и легко реализуется" },
        { id: "good_self_sub_7", text: "Выбирай то, что точно принесёт удовольствие всем" }
      ]
    },
    child: {
      microcopy: [
        { id: "good_child_micro_1", text: "🌤 Неплохой день для планов с {childName}" },
        { id: "good_child_micro_2", text: "☀️ Можно выбрать что-то интересное" },
        { id: "good_child_micro_3", text: "🌤 Погода позволяет быть гибкими" },
        { id: "good_child_micro_4", text: "☀️ Хорошее время показать {childName} что-то новое" },
        { id: "good_child_micro_5", text: "🌤 Сегодня можно совместить разные занятия" },
        { id: "good_child_micro_6", text: "☀️ Подходящий день для детских открытий" },
        { id: "good_child_micro_7", text: "🌤 Время выбрать что-то по душе {childName}" }
      ],
      titles: [
        { id: "good_child_title_1", text: "Что выберем для {childName}?" },
        { id: "good_child_title_2", text: "Найдём подходящее занятие" },
        { id: "good_child_title_3", text: "Посмотрим варианты на день" },
        { id: "good_child_title_4", text: "Можно устроить {childName} приятное время" },
        { id: "good_child_title_5", text: "Выберем что-то по настроению" },
        { id: "good_child_title_6", text: "Давай составим гибкий план" },
        { id: "good_child_title_7", text: "Найдётся что-то интересное" }
      ],
      subtitles: [
        { id: "good_child_sub_1", text: "Есть варианты на разные случаи — выбирай по настроению {childName}" },
        { id: "good_child_sub_2", text: "Здесь найдутся и активные, и спокойные занятия" },
        { id: "good_child_sub_3", text: "Можно легко менять планы, если {childName} передумает" },
        { id: "good_child_sub_4", text: "Сохраняй несколько идей — пригодится для запасного плана" },
        { id: "good_child_sub_5", text: "От игровых площадок до творческих студий — всё проверено" },
        { id: "good_child_sub_6", text: "Каждое место подходит для детей и легко доступно" },
        { id: "good_child_sub_7", text: "Пусть {childName} сам выберет, что ему больше нравится" }
      ]
    },
    family: {
      microcopy: [
        { id: "good_family_micro_1", text: "🌤 Неплохой день для семейного времени" },
        { id: "good_family_micro_2", text: "☀️ Можно выбрать что-то для всех" },
        { id: "good_family_micro_3", text: "🌤 Погода позволяет быть гибкими в планах" },
        { id: "good_family_micro_4", text: "☀️ Хорошее время для общих занятий" },
        { id: "good_family_micro_5", text: "🌤 Сегодня можно совместить разные активности" },
        { id: "good_family_micro_6", text: "☀️ Подходящий день для семейных открытий" },
        { id: "good_family_micro_7", text: "🌤 Время выбрать что-то всем по душе" }
      ],
      titles: [
        { id: "good_family_title_1", text: "Что выберем для всей семьи?" },
        { id: "good_family_title_2", text: "Найдём подходящее занятие для всех" },
        { id: "good_family_title_3", text: "Посмотрим варианты на день" },
        { id: "good_family_title_4", text: "Можно устроить приятное время всем" },
        { id: "good_family_title_5", text: "Выберем что-то по общему настроению" },
        { id: "good_family_title_6", text: "Давай составим гибкий семейный план" },
        { id: "good_family_title_7", text: "Найдётся что-то интересное для всех возрастов" }
      ],
      subtitles: [
        { id: "good_family_sub_1", text: "Есть варианты, где будет комфортно и детям, и взрослым" },
        { id: "good_family_sub_2", text: "Здесь найдутся занятия для разных возрастов и интересов" },
        { id: "good_family_sub_3", text: "Можно легко адаптировать планы под потребности всех" },
        { id: "good_family_sub_4", text: "Сохраняй несколько идей — пригодится для разных ситуаций" },
        { id: "good_family_sub_5", text: "От парков до культурных центров — всё учтено и проверено" },
        { id: "good_family_sub_6", text: "Каждое место подходит для семейного отдыха" },
        { id: "good_family_sub_7", text: "Пусть каждый найдёт что-то интересное в общем дне" }
      ]
    }
  },

  mixed_outdoor: {
    guest: {
      microcopy: [
        { id: "mixed_guest_micro_1", text: "🌤 Переменчивая погода — но это не помеха планам" },
        { id: "mixed_guest_micro_2", text: "☁️ Можно выбрать что-то гибкое на день" },
        { id: "mixed_guest_micro_3", text: "🌤 Погода меняется, но идеи остаются" },
        { id: "mixed_guest_micro_4", text: "☁️ Хорошо иметь варианты на разные случаи" },
        { id: "mixed_guest_micro_5", text: "🌤 Можно совместить и улицу, и помещения" },
        { id: "mixed_guest_micro_6", text: "☁️ Переменчивый день — время для гибких планов" },
        { id: "mixed_guest_micro_7", text: "🌤 Погода непредсказуема, но день может быть отличным" }
      ],
      titles: [
        { id: "mixed_guest_title_1", text: "Найдём варианты на любую погоду" },
        { id: "mixed_guest_title_2", text: "Выберем что-то гибкое" },
        { id: "mixed_guest_title_3", text: "Составим запасной план" },
        { id: "mixed_guest_title_4", text: "Посмотрим универсальные идеи" },
        { id: "mixed_guest_title_5", text: "Можно устроить хороший день в любом случае" },
        { id: "mixed_guest_title_6", text: "Давай подберём адаптивные варианты" },
        { id: "mixed_guest_title_7", text: "Найдётся что-то подходящее" }
      ],
      subtitles: [
        { id: "mixed_guest_sub_1", text: "Здесь есть идеи, которые легко адаптировать под изменения погоды" },
        { id: "mixed_guest_sub_2", text: "Выбирай места с крытыми зонами или быстрым доступом в помещения" },
        { id: "mixed_guest_sub_3", text: "Сохраняй несколько вариантов — пригодится для смены планов" },
        { id: "mixed_guest_sub_4", text: "От торговых центров до парков с павильонами — всё учтено" },
        { id: "mixed_guest_sub_5", text: "Каждая идея проверена на гибкость и доступность" },
        { id: "mixed_guest_sub_6", text: "Можно легко переключаться между активностями по ситуации" },
        { id: "mixed_guest_sub_7", text: "Выбирай то, что точно получится реализовать" }
      ]
    },
    self: {
      microcopy: [
        { id: "mixed_self_micro_1", text: "🌤 Переменчивая погода — но мы справимся" },
        { id: "mixed_self_micro_2", text: "☁️ Можно выбрать что-то адаптивное" },
        { id: "mixed_self_micro_3", text: "🌤 Погода меняется, но планы остаются" },
        { id: "mixed_self_micro_4", text: "☁️ Хорошо иметь гибкие варианты" },
        { id: "mixed_self_micro_5", text: "🌤 Можно совместить разные активности" },
        { id: "mixed_self_micro_6", text: "☁️ Переменчивый день — время для творческих решений" },
        { id: "mixed_self_micro_7", text: "🌤 Погода непредсказуема, но день может быть замечательным" }
      ],
      titles: [
        { id: "mixed_self_title_1", text: "Найдём гибкие варианты на день" },
        { id: "mixed_self_title_2", text: "Выберем что-то адаптивное" },
        { id: "mixed_self_title_3", text: "Составим план с запасными вариантами" },
        { id: "mixed_self_title_4", text: "Посмотрим универсальные идеи" },
        { id: "mixed_self_title_5", text: "Можно устроить отличный день в любом случае" },
        { id: "mixed_self_title_6", text: "Давай подберём надёжные варианты" },
        { id: "mixed_self_title_7", text: "Найдётся что-то подходящее для любой ситуации" }
      ],
      subtitles: [
        { id: "mixed_self_sub_1", text: "Подобрала идеи, которые легко адаптировать под любые изменения" },
        { id: "mixed_self_sub_2", text: "Здесь есть варианты с крытыми зонами и быстрым доступом в помещения" },
        { id: "mixed_self_sub_3", text: "Сохраняй несколько идей — так будет проще менять планы" },
        { id: "mixed_self_sub_4", text: "От крытых рынков до музеев — всё проверено на гибкость" },
        { id: "mixed_self_sub_5", text: "Каждое место подходит для быстрой смены активности" },
        { id: "mixed_self_sub_6", text: "Можно легко переключаться между занятиями по ситуации" },
        { id: "mixed_self_sub_7", text: "Выбирай то, что точно получится и принесёт радость" }
      ]
    },
    child: {
      microcopy: [
        { id: "mixed_child_micro_1", text: "🌤 Переменчивая погода — но {childName} не расстроится" },
        { id: "mixed_child_micro_2", text: "☁️ Можно выбрать что-то гибкое для {childName}" },
        { id: "mixed_child_micro_3", text: "🌤 Погода меняется, но планы с {childName} остаются" },
        { id: "mixed_child_micro_4", text: "☁️ Хорошо иметь варианты на разные случаи" },
        { id: "mixed_child_micro_5", text: "🌤 Можно совместить разные занятия" },
        { id: "mixed_child_micro_6", text: "☁️ Переменчивый день — время для приключений" },
        { id: "mixed_child_micro_7", text: "🌤 Погода непредсказуема, но день может быть отличным" }
      ],
      titles: [
        { id: "mixed_child_title_1", text: "Найдём варианты для {childName} на любую погоду" },
        { id: "mixed_child_title_2", text: "Выберем что-то гибкое" },
        { id: "mixed_child_title_3", text: "Составим план с запасными идеями" },
        { id: "mixed_child_title_4", text: "Посмотрим универсальные варианты" },
        { id: "mixed_child_title_5", text: "Можно устроить {childName} отличный день" },
        { id: "mixed_child_title_6", text: "Давай подберём надёжные идеи" },
        { id: "mixed_child_title_7", text: "Найдётся что-то подходящее" }
      ],
      subtitles: [
        { id: "mixed_child_sub_1", text: "Здесь есть места, где {childName} будет весело в любую погоду" },
        { id: "mixed_child_sub_2", text: "Выбирай варианты с крытыми зонами и быстрым доступом в помещения" },
        { id: "mixed_child_sub_3", text: "Сохраняй несколько идей — так проще менять планы с детьми" },
        { id: "mixed_child_sub_4", text: "От игровых центров до музеев — всё адаптировано для детей" },
        { id: "mixed_child_sub_5", text: "Каждое место проверено на удобство для семей с детьми" },
        { id: "mixed_child_sub_6", text: "Можно легко переключаться между занятиями по настроению {childName}" },
        { id: "mixed_child_sub_7", text: "Пусть {childName} сам выберет из безопасных вариантов" }
      ]
    },
    family: {
      microcopy: [
        { id: "mixed_family_micro_1", text: "🌤 Переменчивая погода — но семья справится" },
        { id: "mixed_family_micro_2", text: "☁️ Можно выбрать что-то гибкое для всех" },
        { id: "mixed_family_micro_3", text: "🌤 Погода меняется, но семейные планы остаются" },
        { id: "mixed_family_micro_4", text: "☁️ Хорошо иметь варианты на разные случаи" },
        { id: "mixed_family_micro_5", text: "🌤 Можно совместить разные семейные активности" },
        { id: "mixed_family_micro_6", text: "☁️ Переменчивый день — время для семейных приключений" },
        { id: "mixed_family_micro_7", text: "🌤 Погода непредсказуема, но день может быть замечательным" }
      ],
      titles: [
        { id: "mixed_family_title_1", text: "Найдём варианты для всей семьи на любую погоду" },
        { id: "mixed_family_title_2", text: "Выберем что-то гибкое для всех" },
        { id: "mixed_family_title_3", text: "Составим семейный план с запасными идеями" },
        { id: "mixed_family_title_4", text: "Посмотрим универсальные семейные варианты" },
        { id: "mixed_family_title_5", text: "Можно устроить отличный день для всех" },
        { id: "mixed_family_title_6", text: "Давай подберём надёжные семейные идеи" },
        { id: "mixed_family_title_7", text: "Найдётся что-то подходящее для всех возрастов" }
      ],
      subtitles: [
        { id: "mixed_family_sub_1", text: "Здесь есть места, где будет комфортно всей семье в любую погоду" },
        { id: "mixed_family_sub_2", text: "Выбирай варианты с крытыми зонами и удобствами для всех возрастов" },
        { id: "mixed_family_sub_3", text: "Сохраняй несколько идей — так проще адаптировать планы под всех" },
        { id: "mixed_family_sub_4", text: "От семейных центров до музеев — всё учитывает потребности разных возрастов" },
        { id: "mixed_family_sub_5", text: "Каждое место проверено на удобство для больших и маленьких" },
        { id: "mixed_family_sub_6", text: "Можно легко переключаться между занятиями по общему настроению" },
        { id: "mixed_family_sub_7", text: "Пусть каждый найдёт что-то интересное в общем семейном дне" }
      ]
    }
  },
  rain_indoor: {
    guest: {
      microcopy: [
        { id: "rain_guest_micro_1", text: "🌧 Дождик за окном — самое время для уютных планов" },
        { id: "rain_guest_micro_2", text: "☔ На улице дождь, но это не повод грустить" },
        { id: "rain_guest_micro_3", text: "🌧 Дождливый день — отличный повод для домашнего уюта" },
        { id: "rain_guest_micro_4", text: "☔ Можно устроить приятный день в помещении" },
        { id: "rain_guest_micro_5", text: "🌧 Дождь создаёт особую атмосферу для семейного времени" },
        { id: "rain_guest_micro_6", text: "☔ Хорошая погода для крытых развлечений" },
        { id: "rain_guest_micro_7", text: "🌧 Дождливые дни тоже могут быть волшебными" }
      ],
      titles: [
        { id: "rain_guest_title_1", text: "Найдём уютные места в помещении" },
        { id: "rain_guest_title_2", text: "Выберем что-то крытое и интересное" },
        { id: "rain_guest_title_3", text: "Посмотрим варианты без привязки к погоде" },
        { id: "rain_guest_title_4", text: "Можно отлично провести время в помещении" },
        { id: "rain_guest_title_5", text: "Давай найдём идеи для дождливого дня" },
        { id: "rain_guest_title_6", text: "Составим план для крытых развлечений" },
        { id: "rain_guest_title_7", text: "Дождь — не помеха хорошему дню" }
      ],
      subtitles: [
        { id: "rain_guest_sub_1", text: "Собрала лучшие места в Минске, где можно провести день независимо от погоды" },
        { id: "rain_guest_sub_2", text: "От игровых центров до музеев — всё под крышей и очень интересно" },
        { id: "rain_guest_sub_3", text: "Здесь найдутся варианты для любого возраста и настроения" },
        { id: "rain_guest_sub_4", text: "Выбирай уютные места, где можно согреться и повеселиться" },
        { id: "rain_guest_sub_5", text: "Каждое место проверено семьями и подходит для детей" },
        { id: "rain_guest_sub_6", text: "Сохраняй идеи и планируй комфортный день без зависимости от дождя" },
        { id: "rain_guest_sub_7", text: "Пусть дождь за окном станет поводом для особенных впечатлений" }
      ]
    },
    self: {
      microcopy: [
        { id: "rain_self_micro_1", text: "🌧 Дождик за окном — время для уютных планов" },
        { id: "rain_self_micro_2", text: "☔ На улице дождь, но мы найдём что-то интересное" },
        { id: "rain_self_micro_3", text: "🌧 Дождливый день — повод для особенного времени" },
        { id: "rain_self_micro_4", text: "☔ Можно устроить отличный день в тепле и уюте" },
        { id: "rain_self_micro_5", text: "🌧 Дождь создаёт идеальную атмосферу для семейного досуга" },
        { id: "rain_self_micro_6", text: "☔ Хорошая погода для крытых приключений" },
        { id: "rain_self_micro_7", text: "🌧 Дождливые дни могут быть самыми запоминающимися" }
      ],
      titles: [
        { id: "rain_self_title_1", text: "Найдём уютные места для семьи" },
        { id: "rain_self_title_2", text: "Выберем что-то крытое и весёлое" },
        { id: "rain_self_title_3", text: "Посмотрим варианты в помещениях" },
        { id: "rain_self_title_4", text: "Можно отлично провести дождливый день" },
        { id: "rain_self_title_5", text: "Давай найдём идеи для комфортного досуга" },
        { id: "rain_self_title_6", text: "Составим план для крытых развлечений" },
        { id: "rain_self_title_7", text: "Дождь — повод для особенных планов" }
      ],
      subtitles: [
        { id: "rain_self_sub_1", text: "Подобрала места, где твоей семье будет тепло, уютно и интересно" },
        { id: "rain_self_sub_2", text: "От творческих студий до развлекательных центров — всё под крышей" },
        { id: "rain_self_sub_3", text: "Здесь есть варианты для разных возрастов и интересов" },
        { id: "rain_self_sub_4", text: "Выбирай места, где можно согреться душой и телом" },
        { id: "rain_self_sub_5", text: "Каждое место проверено и подходит для семейного отдыха" },
        { id: "rain_self_sub_6", text: "Сохраняй идеи и создавай комфортные планы на любую погоду" },
        { id: "rain_self_sub_7", text: "Пусть дождь станет поводом для новых семейных традиций" }
      ]
    },
    child: {
      microcopy: [
        { id: "rain_child_micro_1", text: "🌧 Дождик за окном — время для уютных планов с {childName}" },
        { id: "rain_child_micro_2", text: "☔ На улице дождь, но {childName} не заскучает" },
        { id: "rain_child_micro_3", text: "🌧 Дождливый день — повод для особенного времени" },
        { id: "rain_child_micro_4", text: "☔ Можно устроить {childName} отличный день в тепле" },
        { id: "rain_child_micro_5", text: "🌧 Дождь создаёт идеальную атмосферу для игр" },
        { id: "rain_child_micro_6", text: "☔ Хорошая погода для крытых приключений" },
        { id: "rain_child_micro_7", text: "🌧 Дождливые дни могут быть самыми весёлыми" }
      ],
      titles: [
        { id: "rain_child_title_1", text: "Найдём уютные места для {childName}" },
        { id: "rain_child_title_2", text: "Выберем что-то крытое и весёлое" },
        { id: "rain_child_title_3", text: "Посмотрим варианты в помещениях" },
        { id: "rain_child_title_4", text: "Можно устроить {childName} отличный день" },
        { id: "rain_child_title_5", text: "Давай найдём идеи для комфортного досуга" },
        { id: "rain_child_title_6", text: "Составим план для крытых развлечений" },
        { id: "rain_child_title_7", text: "Дождь — повод для особенных планов" }
      ],
      subtitles: [
        { id: "rain_child_sub_1", text: "Здесь есть места, где {childName} будет в восторге, несмотря на дождь" },
        { id: "rain_child_sub_2", text: "От игровых комнат до мастер-классов — всё под крышей и очень весело" },
        { id: "rain_child_sub_3", text: "Выбирай варианты по возрасту и интересам {childName}" },
        { id: "rain_child_sub_4", text: "Каждое место безопасно, тепло и подходит для детей" },
        { id: "rain_child_sub_5", text: "Сохраняй идеи и планируй комфортные дни независимо от погоды" },
        { id: "rain_child_sub_6", text: "Пусть {childName} сам выберет из уютных и интересных вариантов" },
        { id: "rain_child_sub_7", text: "Дождь за окном может стать началом нового приключения" }
      ]
    },
    family: {
      microcopy: [
        { id: "rain_family_micro_1", text: "🌧 Дождик за окном — время для уютных семейных планов" },
        { id: "rain_family_micro_2", text: "☔ На улице дождь, но семья найдёт что-то интересное" },
        { id: "rain_family_micro_3", text: "🌧 Дождливый день — повод для особенного семейного времени" },
        { id: "rain_family_micro_4", text: "☔ Можно устроить всем отличный день в тепле и уюте" },
        { id: "rain_family_micro_5", text: "🌧 Дождь создаёт идеальную атмосферу для семейного досуга" },
        { id: "rain_family_micro_6", text: "☔ Хорошая погода для крытых семейных приключений" },
        { id: "rain_family_micro_7", text: "🌧 Дождливые дни могут стать самыми тёплыми воспоминаниями" }
      ],
      titles: [
        { id: "rain_family_title_1", text: "Найдём уютные места для всей семьи" },
        { id: "rain_family_title_2", text: "Выберем что-то крытое и интересное для всех" },
        { id: "rain_family_title_3", text: "Посмотрим семейные варианты в помещениях" },
        { id: "rain_family_title_4", text: "Можно отлично провести дождливый день всем вместе" },
        { id: "rain_family_title_5", text: "Давай найдём идеи для комфортного семейного досуга" },
        { id: "rain_family_title_6", text: "Составим план для крытых семейных развлечений" },
        { id: "rain_family_title_7", text: "Дождь — повод для особенных семейных планов" }
      ],
      subtitles: [
        { id: "rain_family_sub_1", text: "Здесь есть места, где будет комфортно и интересно всем возрастам" },
        { id: "rain_family_sub_2", text: "От семейных кафе до развлекательных центров — всё под крышей" },
        { id: "rain_family_sub_3", text: "Выбирай варианты, где каждый найдёт занятие по душе" },
        { id: "rain_family_sub_4", text: "Каждое место проверено семьями и подходит для общего отдыха" },
        { id: "rain_family_sub_5", text: "Сохраняй идеи и создавай уютные семейные традиции" },
        { id: "rain_family_sub_6", text: "Пусть каждый выберет что-то интересное в общем семейном дне" },
        { id: "rain_family_sub_7", text: "Дождь за окном может стать началом новых семейных воспоминаний" }
      ]
    }
  },

  heavy_rain_indoor: {
    guest: {
      microcopy: [
        { id: "heavy_rain_guest_micro_1", text: "🌧 Сильный дождь — точно время для помещений" },
        { id: "heavy_rain_guest_micro_2", text: "☔ Ливень за окном, но день может быть отличным" },
        { id: "heavy_rain_guest_micro_3", text: "🌧 Такая погода — повод для уютных крытых планов" },
        { id: "heavy_rain_guest_micro_4", text: "☔ Можно прекрасно провести время в тепле и сухости" },
        { id: "heavy_rain_guest_micro_5", text: "🌧 Ливень создаёт особую атмосферу для домашнего уюта" },
        { id: "heavy_rain_guest_micro_6", text: "☔ Отличная погода для крытых развлечений" },
        { id: "heavy_rain_guest_micro_7", text: "🌧 Сильный дождь — не повод отменять планы" }
      ],
      titles: [
        { id: "heavy_rain_guest_title_1", text: "Найдём отличные крытые места" },
        { id: "heavy_rain_guest_title_2", text: "Выберем что-то уютное в помещении" },
        { id: "heavy_rain_guest_title_3", text: "Посмотрим варианты без привязки к погоде" },
        { id: "heavy_rain_guest_title_4", text: "Можно замечательно провести день в тепле" },
        { id: "heavy_rain_guest_title_5", text: "Давай найдём идеи для ливневого дня" },
        { id: "heavy_rain_guest_title_6", text: "Составим план для комфортного досуга" },
        { id: "heavy_rain_guest_title_7", text: "Ливень — повод для особенных планов" }
      ],
      subtitles: [
        { id: "heavy_rain_guest_sub_1", text: "Собрала самые уютные места в Минске, где точно будет сухо и интересно" },
        { id: "heavy_rain_guest_sub_2", text: "От торговых центров до культурных пространств — всё под надёжной крышей" },
        { id: "heavy_rain_guest_sub_3", text: "Здесь найдутся варианты для любого возраста, независимо от погоды" },
        { id: "heavy_rain_guest_sub_4", text: "Выбирай места с хорошим отоплением и комфортной атмосферой" },
        { id: "heavy_rain_guest_sub_5", text: "Каждое место проверено и гарантированно защищено от непогоды" },
        { id: "heavy_rain_guest_sub_6", text: "Сохраняй идеи и планируй день без оглядки на ливень" },
        { id: "heavy_rain_guest_sub_7", text: "Пусть сильный дождь станет поводом для новых открытий в помещении" }
      ]
    },
    self: {
      microcopy: [
        { id: "heavy_rain_self_micro_1", text: "🌧 Сильный дождь — время для уютных планов" },
        { id: "heavy_rain_self_micro_2", text: "☔ Ливень за окном, но мы найдём что-то отличное" },
        { id: "heavy_rain_self_micro_3", text: "🌧 Такая погода — повод для особенного времени в тепле" },
        { id: "heavy_rain_self_micro_4", text: "☔ Можно прекрасно провести день в комфорте" },
        { id: "heavy_rain_self_micro_5", text: "🌧 Ливень создаёт идеальную атмосферу для семейного уюта" },
        { id: "heavy_rain_self_micro_6", text: "☔ Отличная погода для крытых семейных планов" },
        { id: "heavy_rain_self_micro_7", text: "🌧 Сильный дождь — не помеха хорошему дню" }
      ],
      titles: [
        { id: "heavy_rain_self_title_1", text: "Найдём уютные крытые места" },
        { id: "heavy_rain_self_title_2", text: "Выберем что-то комфортное для семьи" },
        { id: "heavy_rain_self_title_3", text: "Посмотрим надёжные варианты в помещениях" },
        { id: "heavy_rain_self_title_4", text: "Можно замечательно провести ливневый день" },
        { id: "heavy_rain_self_title_5", text: "Давай найдём идеи для комфортного досуга" },
        { id: "heavy_rain_self_title_6", text: "Составим план для тёплых развлечений" },
        { id: "heavy_rain_self_title_7", text: "Ливень — повод для особенных семейных планов" }
      ],
      subtitles: [
        { id: "heavy_rain_self_sub_1", text: "Подобрала самые комфортные места, где твоей семье будет тепло и весело" },
        { id: "heavy_rain_self_sub_2", text: "От игровых центров до музеев — всё с хорошим отоплением и атмосферой" },
        { id: "heavy_rain_self_sub_3", text: "Здесь есть варианты для всех возрастов, полностью защищённые от непогоды" },
        { id: "heavy_rain_self_sub_4", text: "Выбирай места, где можно расслабиться и насладиться семейным временем" },
        { id: "heavy_rain_self_sub_5", text: "Каждое место проверено и гарантированно подходит для ливневых дней" },
        { id: "heavy_rain_self_sub_6", text: "Сохраняй идеи и создавай уютные планы независимо от погоды" },
        { id: "heavy_rain_self_sub_7", text: "Пусть ливень станет поводом для новых семейных традиций в тепле" }
      ]
    },
    child: {
      microcopy: [
        { id: "heavy_rain_child_micro_1", text: "🌧 Сильный дождь — время для уютных планов с {childName}" },
        { id: "heavy_rain_child_micro_2", text: "☔ Ливень за окном, но {childName} точно не заскучает" },
        { id: "heavy_rain_child_micro_3", text: "🌧 Такая погода — повод для особенного времени в тепле" },
        { id: "heavy_rain_child_micro_4", text: "☔ Можно устроить {childName} прекрасный день в комфорте" },
        { id: "heavy_rain_child_micro_5", text: "🌧 Ливень создаёт идеальную атмосферу для игр в помещении" },
        { id: "heavy_rain_child_micro_6", text: "☔ Отличная погода для крытых детских приключений" },
        { id: "heavy_rain_child_micro_7", text: "🌧 Сильный дождь — не помеха весёлому дню" }
      ],
      titles: [
        { id: "heavy_rain_child_title_1", text: "Найдём уютные места для {childName}" },
        { id: "heavy_rain_child_title_2", text: "Выберем что-то тёплое и весёлое" },
        { id: "heavy_rain_child_title_3", text: "Посмотрим детские варианты в помещениях" },
        { id: "heavy_rain_child_title_4", text: "Можно устроить {childName} замечательный день" },
        { id: "heavy_rain_child_title_5", text: "Давай найдём идеи для комфортного досуга" },
        { id: "heavy_rain_child_title_6", text: "Составим план для тёплых развлечений" },
        { id: "heavy_rain_child_title_7", text: "Ливень — повод для особенных планов" }
      ],
      subtitles: [
        { id: "heavy_rain_child_sub_1", text: "Здесь есть места, где {childName} будет в восторге, несмотря на ливень" },
        { id: "heavy_rain_child_sub_2", text: "От игровых комнат до творческих студий — всё тёплое и безопасное" },
        { id: "heavy_rain_child_sub_3", text: "Выбирай варианты по возрасту {childName}, полностью защищённые от дождя" },
        { id: "heavy_rain_child_sub_4", text: "Каждое место с хорошим отоплением и подходит для детей" },
        { id: "heavy_rain_child_sub_5", text: "Сохраняй идеи и планируй уютные дни независимо от погоды" },
        { id: "heavy_rain_child_sub_6", text: "Пусть {childName} сам выберет из тёплых и интересных вариантов" },
        { id: "heavy_rain_child_sub_7", text: "Ливень за окном может стать началом уютного приключения" }
      ]
    },
    family: {
      microcopy: [
        { id: "heavy_rain_family_micro_1", text: "🌧 Сильный дождь — время для уютных семейных планов" },
        { id: "heavy_rain_family_micro_2", text: "☔ Ливень за окном, но семья найдёт отличные варианты" },
        { id: "heavy_rain_family_micro_3", text: "🌧 Такая погода — повод для особенного семейного времени в тепле" },
        { id: "heavy_rain_family_micro_4", text: "☔ Можно прекрасно провести день всей семьёй в комфорте" },
        { id: "heavy_rain_family_micro_5", text: "🌧 Ливень создаёт идеальную атмосферу для семейного уюта" },
        { id: "heavy_rain_family_micro_6", text: "☔ Отличная погода для крытых семейных приключений" },
        { id: "heavy_rain_family_micro_7", text: "🌧 Сильный дождь — не помеха семейному счастью" }
      ],
      titles: [
        { id: "heavy_rain_family_title_1", text: "Найдём уютные места для всей семьи" },
        { id: "heavy_rain_family_title_2", text: "Выберем что-то тёплое и интересное для всех" },
        { id: "heavy_rain_family_title_3", text: "Посмотрим семейные варианты в помещениях" },
        { id: "heavy_rain_family_title_4", text: "Можно замечательно провести ливневый день всем вместе" },
        { id: "heavy_rain_family_title_5", text: "Давай найдём идеи для комфортного семейного досуга" },
        { id: "heavy_rain_family_title_6", text: "Составим план для тёплых семейных развлечений" },
        { id: "heavy_rain_family_title_7", text: "Ливень — повод для особенных семейных планов" }
      ],
      subtitles: [
        { id: "heavy_rain_family_sub_1", text: "Здесь есть места, где будет тепло и интересно всем возрастам" },
        { id: "heavy_rain_family_sub_2", text: "От семейных центров до музеев — всё с отличным отоплением" },
        { id: "heavy_rain_family_sub_3", text: "Выбирай варианты, где каждый найдёт уютное занятие по душе" },
        { id: "heavy_rain_family_sub_4", text: "Каждое место проверено семьями и защищено от любой непогоды" },
        { id: "heavy_rain_family_sub_5", text: "Сохраняй идеи и создавай тёплые семейные традиции" },
        { id: "heavy_rain_family_sub_6", text: "Пусть каждый выберет что-то интересное в общем уютном дне" },
        { id: "heavy_rain_family_sub_7", text: "Ливень за окном может стать началом самых тёплых семейных воспоминаний" }
      ]
    }
  },
  windy_caution: {
    guest: {
      microcopy: [
        { id: "windy_guest_micro_1", text: "💨 Ветрено на улице — лучше выбрать что-то защищённое" },
        { id: "windy_guest_micro_2", text: "🌬 Сильный ветер, но можно найти укрытые места" },
        { id: "windy_guest_micro_3", text: "💨 Ветреный день — время для крытых или защищённых вариантов" },
        { id: "windy_guest_micro_4", text: "🌬 Можно выбрать места с ветрозащитой" },
        { id: "windy_guest_micro_5", text: "💨 Ветер сильный — лучше планировать осторожно" },
        { id: "windy_guest_micro_6", text: "🌬 Ветреная погода — повод для защищённых развлечений" },
        { id: "windy_guest_micro_7", text: "💨 Сильный ветер не помешает хорошему дню" }
      ],
      titles: [
        { id: "windy_guest_title_1", text: "Найдём защищённые от ветра места" },
        { id: "windy_guest_title_2", text: "Выберем что-то укрытое и безопасное" },
        { id: "windy_guest_title_3", text: "Посмотрим варианты с ветрозащитой" },
        { id: "windy_guest_title_4", text: "Можно комфортно провести ветреный день" },
        { id: "windy_guest_title_5", text: "Давай найдём идеи для безопасного досуга" },
        { id: "windy_guest_title_6", text: "Составим план с учётом ветра" },
        { id: "windy_guest_title_7", text: "Ветер — не помеха хорошим планам" }
      ],
      subtitles: [
        { id: "windy_guest_sub_1", text: "Собрала места с хорошей защитой от ветра и безопасные для детей" },
        { id: "windy_guest_sub_2", text: "От крытых площадок до помещений — всё учитывает ветреную погоду" },
        { id: "windy_guest_sub_3", text: "Здесь найдутся варианты, где ветер не помешает веселью" },
        { id: "windy_guest_sub_4", text: "Выбирай места с навесами, стенами или полностью закрытые" },
        { id: "windy_guest_sub_5", text: "Каждое место проверено на безопасность в ветреную погоду" },
        { id: "windy_guest_sub_6", text: "Сохраняй идеи и планируй день с учётом погодных условий" },
        { id: "windy_guest_sub_7", text: "Пусть ветер станет поводом открыть новые укрытые места" }
      ]
    },
    self: {
      microcopy: [
        { id: "windy_self_micro_1", text: "💨 Ветрено на улице — найдём защищённые варианты" },
        { id: "windy_self_micro_2", text: "🌬 Сильный ветер, но мы справимся" },
        { id: "windy_self_micro_3", text: "💨 Ветреный день — время для осторожных планов" },
        { id: "windy_self_micro_4", text: "🌬 Можно выбрать безопасные места с ветрозащитой" },
        { id: "windy_self_micro_5", text: "💨 Ветер сильный — планируем с умом" },
        { id: "windy_self_micro_6", text: "🌬 Ветреная погода — повод для укрытых развлечений" },
        { id: "windy_self_micro_7", text: "💨 Сильный ветер не испортит семейный день" }
      ],
      titles: [
        { id: "windy_self_title_1", text: "Найдём безопасные места от ветра" },
        { id: "windy_self_title_2", text: "Выберем что-то защищённое для семьи" },
        { id: "windy_self_title_3", text: "Посмотрим укрытые варианты" },
        { id: "windy_self_title_4", text: "Можно комфортно провести ветреный день" },
        { id: "windy_self_title_5", text: "Давай найдём идеи с ветрозащитой" },
        { id: "windy_self_title_6", text: "Составим безопасный план на день" },
        { id: "windy_self_title_7", text: "Ветер — не помеха семейным планам" }
      ],
      subtitles: [
        { id: "windy_self_sub_1", text: "Подобрала места, где твоей семье будет комфортно и безопасно" },
        { id: "windy_self_sub_2", text: "От защищённых площадок до помещений — всё с учётом ветра" },
        { id: "windy_self_sub_3", text: "Здесь есть варианты, где ветреная погода не помешает отдыху" },
        { id: "windy_self_sub_4", text: "Выбирай места с хорошими укрытиями и безопасными зонами" },
        { id: "windy_self_sub_5", text: "Каждое место проверено на комфорт в ветреную погоду" },
        { id: "windy_self_sub_6", text: "Сохраняй идеи и создавай планы с заботой о безопасности" },
        { id: "windy_self_sub_7", text: "Пусть ветер станет поводом открыть новые защищённые места" }
      ]
    },
    child: {
      microcopy: [
        { id: "windy_child_micro_1", text: "💨 Ветрено на улице — найдём безопасные места для {childName}" },
        { id: "windy_child_micro_2", text: "🌬 Сильный ветер, но {childName} не останется без развлечений" },
        { id: "windy_child_micro_3", text: "💨 Ветреный день — время для защищённых планов" },
        { id: "windy_child_micro_4", text: "🌬 Можно найти укрытые места для {childName}" },
        { id: "windy_child_micro_5", text: "💨 Ветер сильный — планируем безопасно" },
        { id: "windy_child_micro_6", text: "🌬 Ветреная погода — повод для крытых детских развлечений" },
        { id: "windy_child_micro_7", text: "💨 Сильный ветер не помешает весёлому дню" }
      ],
      titles: [
        { id: "windy_child_title_1", text: "Найдём безопасные места для {childName}" },
        { id: "windy_child_title_2", text: "Выберем что-то защищённое от ветра" },
        { id: "windy_child_title_3", text: "Посмотрим укрытые детские варианты" },
        { id: "windy_child_title_4", text: "Можно устроить {childName} комфортный день" },
        { id: "windy_child_title_5", text: "Давай найдём идеи с ветрозащитой" },
        { id: "windy_child_title_6", text: "Составим безопасный план для {childName}" },
        { id: "windy_child_title_7", text: "Ветер — не помеха детским планам" }
      ],
      subtitles: [
        { id: "windy_child_sub_1", text: "Здесь есть места, где {childName} будет в безопасности от ветра" },
        { id: "windy_child_sub_2", text: "От крытых игровых до помещений — всё защищено и безопасно" },
        { id: "windy_child_sub_3", text: "Выбирай варианты по возрасту {childName} с хорошими укрытиями" },
        { id: "windy_child_sub_4", text: "Каждое место проверено на детскую безопасность в ветреную погоду" },
        { id: "windy_child_sub_5", text: "Сохраняй идеи и планируй дни с заботой о комфорте {childName}" },
        { id: "windy_child_sub_6", text: "Пусть {childName} сам выберет из безопасных и интересных вариантов" },
        { id: "windy_child_sub_7", text: "Ветер за окном не помешает детским открытиям в укрытии" }
      ]
    },
    family: {
      microcopy: [
        { id: "windy_family_micro_1", text: "💨 Ветрено на улице — найдём защищённые семейные места" },
        { id: "windy_family_micro_2", text: "🌬 Сильный ветер, но семья найдёт укрытые варианты" },
        { id: "windy_family_micro_3", text: "💨 Ветреный день — время для безопасных семейных планов" },
        { id: "windy_family_micro_4", text: "🌬 Можно найти комфортные места с ветрозащитой для всех" },
        { id: "windy_family_micro_5", text: "💨 Ветер сильный — планируем семейный день с умом" },
        { id: "windy_family_micro_6", text: "🌬 Ветреная погода — повод для крытых семейных развлечений" },
        { id: "windy_family_micro_7", text: "💨 Сильный ветер не помешает семейному счастью" }
      ],
      titles: [
        { id: "windy_family_title_1", text: "Найдём безопасные места для всей семьи" },
        { id: "windy_family_title_2", text: "Выберем что-то защищённое от ветра для всех" },
        { id: "windy_family_title_3", text: "Посмотрим укрытые семейные варианты" },
        { id: "windy_family_title_4", text: "Можно комфортно провести ветреный день всем вместе" },
        { id: "windy_family_title_5", text: "Давай найдём идеи с ветрозащитой для всех" },
        { id: "windy_family_title_6", text: "Составим безопасный семейный план" },
        { id: "windy_family_title_7", text: "Ветер — не помеха семейным планам" }
      ],
      subtitles: [
        { id: "windy_family_sub_1", text: "Здесь есть места, где будет комфортно и безопасно всем возрастам" },
        { id: "windy_family_sub_2", text: "От защищённых площадок до семейных центров — всё с учётом ветра" },
        { id: "windy_family_sub_3", text: "Выбирай варианты с хорошими укрытиями для всей семьи" },
        { id: "windy_family_sub_4", text: "Каждое место проверено на семейную безопасность в ветреную погоду" },
        { id: "windy_family_sub_5", text: "Сохраняй идеи и создавай планы с заботой о комфорте всех" },
        { id: "windy_family_sub_6", text: "Пусть каждый найдёт что-то интересное в общем защищённом дне" },
        { id: "windy_family_sub_7", text: "Ветер за окном не помешает семейным открытиям в укрытии" }
      ]
    }
  },

  cold_mixed: {
    guest: {
      microcopy: [
        { id: "cold_guest_micro_1", text: "🧥 Прохладно на улице — можно совместить тёплые и свежие планы" },
        { id: "cold_guest_micro_2", text: "❄️ Холодновато, но есть варианты и в тепле, и на свежем воздухе" },
        { id: "cold_guest_micro_3", text: "🧥 Прохладная погода — время для гибких планов" },
        { id: "cold_guest_micro_4", text: "❄️ Можно выбрать что-то тёплое или бодрящее" },
        { id: "cold_guest_micro_5", text: "🧥 Холодно, но это не помеха хорошему дню" },
        { id: "cold_guest_micro_6", text: "❄️ Прохладная погода — повод для разнообразных планов" },
        { id: "cold_guest_micro_7", text: "🧥 Можно и согреться, и подышать свежим воздухом" }
      ],
      titles: [
        { id: "cold_guest_title_1", text: "Найдём варианты и в тепле, и на свежем воздухе" },
        { id: "cold_guest_title_2", text: "Выберем что-то подходящее для прохладной погоды" },
        { id: "cold_guest_title_3", text: "Посмотрим гибкие идеи на холодный день" },
        { id: "cold_guest_title_4", text: "Можно устроить хороший день в любом формате" },
        { id: "cold_guest_title_5", text: "Давай найдём идеи для прохладной погоды" },
        { id: "cold_guest_title_6", text: "Составим план с тёплыми и бодрящими вариантами" },
        { id: "cold_guest_title_7", text: "Холод — не помеха интересным планам" }
      ],
      subtitles: [
        { id: "cold_guest_sub_1", text: "" }
      ]
    },
    self: {
      microcopy: [
        { id: "cold_self_micro_1", text: "🧥 Прохладно на улице — найдём подходящие варианты" },
        { id: "cold_self_micro_2", text: "❄️ Холодновато, но можно выбрать по настроению" },
        { id: "cold_self_micro_3", text: "🧥 Прохладная погода — время для гибких решений" },
        { id: "cold_self_micro_4", text: "❄️ Можно и согреться, и подышать свежим воздухом" },
        { id: "cold_self_micro_5", text: "🧥 Холодно, но это добавляет вариантов" },
        { id: "cold_self_micro_6", text: "❄️ Прохладная погода — повод для разных планов" },
        { id: "cold_self_micro_7", text: "🧥 Можно выбрать тёплые или бодрящие занятия" }
      ],
      titles: [
        { id: "cold_self_title_1", text: "Найдём варианты для прохладного дня" },
        { id: "cold_self_title_2", text: "Выберем что-то по настроению и погоде" },
        { id: "cold_self_title_3", text: "Посмотрим гибкие идеи для семьи" },
        { id: "cold_self_title_4", text: "Можно устроить хороший день в любом формате" },
        { id: "cold_self_title_5", text: "Давай найдём идеи для холодной погоды" },
        { id: "cold_self_title_6", text: "Составим план с разными вариантами" },
        { id: "cold_self_title_7", text: "Холод — не помеха семейным планам" }
      ],
      subtitles: [
        { id: "cold_self_sub_1", text: "" }
      ]
    },
    child: {
      microcopy: [
        { id: "cold_child_micro_1", text: "🧥 Прохладно на улице — найдём подходящие варианты для {childName}" },
        { id: "cold_child_micro_2", text: "❄️ Холодновато, но {childName} точно не замёрзнет" },
        { id: "cold_child_micro_3", text: "🧥 Прохладная погода — время для тёплых планов" },
        { id: "cold_child_micro_4", text: "❄️ Можно выбрать что-то уютное для {childName}" },
        { id: "cold_child_micro_5", text: "🧥 Холодно, но это не помеха детским планам" },
        { id: "cold_child_micro_6", text: "❄️ Прохладная погода — повод для разных занятий" },
        { id: "cold_child_micro_7", text: "🧥 Можно и согреться, и активно провести время" }
      ],
      titles: [
        { id: "cold_child_title_1", text: "Найдём тёплые варианты для {childName}" },
        { id: "cold_child_title_2", text: "Выберем что-то подходящее для прохладной погоды" },
        { id: "cold_child_title_3", text: "Посмотрим уютные идеи на холодный день" },
        { id: "cold_child_title_4", text: "Можно устроить {childName} хороший день" },
        { id: "cold_child_title_5", text: "Давай найдём идеи для прохладной погоды" },
        { id: "cold_child_title_6", text: "Составим тёплый план для {childName}" },
        { id: "cold_child_title_7", text: "Холод — не помеха детским планам" }
      ],
      subtitles: [
        { id: "cold_child_sub_1", text: "" }
      ]
    },
    family: {
      microcopy: [
        { id: "cold_family_micro_1", text: "🧥 Прохладно на улице — найдём подходящие семейные варианты" },
        { id: "cold_family_micro_2", text: "❄️ Холодновато, но семья найдёт что-то по душе" },
        { id: "cold_family_micro_3", text: "🧥 Прохладная погода — время для гибких семейных планов" },
        { id: "cold_family_micro_4", text: "❄️ Можно выбрать тёплые или бодрящие занятия для всех" },
        { id: "cold_family_micro_5", text: "🧥 Холодно, но это не помеха семейному времени" },
        { id: "cold_family_micro_6", text: "❄️ Прохладная погода — повод для разных семейных активностей" },
        { id: "cold_family_micro_7", text: "🧥 Можно и согреться всем вместе, и активно провести время" }
      ],
      titles: [
        { id: "cold_family_title_1", text: "Найдём варианты для всей семьи в прохладную погоду" },
        { id: "cold_family_title_2", text: "Выберем что-то подходящее для всех возрастов" },
        { id: "cold_family_title_3", text: "Посмотрим гибкие семейные идеи на холодный день" },
        { id: "cold_family_title_4", text: "Можно устроить хороший день для всей семьи" },
        { id: "cold_family_title_5", text: "Давай найдём идеи для прохладной погоды" },
        { id: "cold_family_title_6", text: "Составим план с разными семейными вариантами" },
        { id: "cold_family_title_7", text: "Холод — не помеха семейным планам" }
      ],
      subtitles: [
        { id: "cold_family_sub_1", text: "" }
      ]
    }
  },

  snow_indoor: {
    guest: {
      microcopy: [
        { id: "snow_guest_micro_1", text: "❄️ Снег за окном — можно и покататься, и согреться внутри" },
        { id: "snow_guest_micro_2", text: "⛄ Зимняя сказка на улице — отличный повод для уютных планов" },
        { id: "snow_guest_micro_3", text: "🌨 Снежный день — самое время для тёплых семейных идей" },
        { id: "snow_guest_micro_4", text: "❄️ Пуховый снег — и повод прогуляться, и повод зайти в тепло" },
        { id: "snow_guest_micro_5", text: "⛄ Морозец щиплет щёки — зато настроение зимнее и домашнее" },
        { id: "snow_guest_micro_6", text: "🌨 Белым-бело — хочется чего-то волшебного на сегодня" },
        { id: "snow_guest_micro_7", text: "❄️ Снежно и тихо — можно придумать день без спешки" }
      ],
      titles: [
        { id: "snow_guest_title_1", text: "Соберём зимний день без суеты" },
        { id: "snow_guest_title_2", text: "Найдём и прогулку, и уют в помещении" },
        { id: "snow_guest_title_3", text: "Что сделаем в снежный день?" },
        { id: "snow_guest_title_4", text: "Можно и на свежий воздух, и в тепло — как захочется" },
        { id: "snow_guest_title_5", text: "Давай подберём что-то по настроению" },
        { id: "snow_guest_title_6", text: "Снежная погода — не повод откладывать радость" },
        { id: "snow_guest_title_7", text: "Выберем план, который подойдёт всей семье" }
      ],
      subtitles: [
        { id: "snow_guest_sub_1", text: "Есть варианты и для снежных прогулок, и для тёплых занятий внутри" },
        { id: "snow_guest_sub_2", text: "Смотри, что рядом: можно быстро сменить сцену, если станет холодно" },
        { id: "snow_guest_sub_3", text: "Сохраняй понравившиеся места и собирай день без лишней суеты" },
        { id: "snow_guest_sub_4", text: "Подойдёт и для малышей в коляске, и для тех, кто уже бегает по сугробам" },
        { id: "snow_guest_sub_5", text: "Без списков на три страницы — просто выбери, что откликается" },
        { id: "snow_guest_sub_6", text: "Минск зимой умеет быть уютным — покажу, где это особенно заметно" },
        { id: "snow_guest_sub_7", text: "Хочется гулять или сидеть с какао — оба варианта здесь есть" }
      ]
    },
    self: {
      microcopy: [
        { id: "snow_self_micro_1", text: "❄️ Снег — и повод погулять, и повод спрятаться в тепло" },
        { id: "snow_self_micro_2", text: "⛄ Зима наконец-то по-настоящему — можно выбрать свой темп" },
        { id: "snow_self_micro_3", text: "🌨 Снежно за окном — удобный момент спланировать день спокойно" },
        { id: "snow_self_micro_4", text: "❄️ Мороз не страшен, если заранее знать, куда зайти согреться" },
        { id: "snow_self_micro_5", text: "⛄ Белый день — хочется чего-то простого и хорошего для семьи" },
        { id: "snow_self_micro_6", text: "🌨 Сугробы — не помеха, если есть запасной тёплый план" },
        { id: "snow_self_micro_7", text: "❄️ Снежная погода зовёт на прогулку — но только если вам по пути" }
      ],
      titles: [
        { id: "snow_self_title_1", text: "Как проведём сегодня — активно или уютно?" },
        { id: "snow_self_title_2", text: "Подберём зимний день под ваше настроение" },
        { id: "snow_self_title_3", text: "Снежный день — давай без давления, просто выберем" },
        { id: "snow_self_title_4", text: "Хочется на улицу или в тепло — оба плана возможны" },
        { id: "snow_self_title_5", text: "Составим день так, чтобы никому не мёрзнуть зря" },
        { id: "snow_self_title_6", text: "Найдём варианты рядом — меньше дороги, больше настроения" },
        { id: "snow_self_title_7", text: "Зима — повод сделать день особенным, а не выматывающим" }
      ],
      subtitles: [
        { id: "snow_self_sub_1", text: "Собрала идеи, где легко совместить прогулку и тёплую паузу" },
        { id: "snow_self_sub_2", text: "Можно начать с улицы и перейти внутрь без длинных переездов" },
        { id: "snow_self_sub_3", text: "Сохраняй то, что зацепило — потом вернёшься к списку в спокойную минуту" },
        { id: "snow_self_sub_4", text: "Без навязчивых «лучших» мест — только то, что реально удобно с детьми" },
        { id: "snow_self_sub_5", text: "Если устали от ветра — рядом обычно есть куда зайти погреться" },
        { id: "snow_self_sub_6", text: "Выбирай по энергии: тихо, шумно, двигаться или посидеть" },
        { id: "snow_self_sub_7", text: "День можно собрать из двух коротких кусочков — и это нормально" }
      ]
    },
    child: {
      microcopy: [
        { id: "snow_child_micro_1", text: "❄️ Снег — {childName} точно оценит, если подобрать по настроению", usesChildName: true },
        { id: "snow_child_micro_2", text: "⛄ Зимний день — можно устроить маленькое приключение" },
        { id: "snow_child_micro_3", text: "🌨 Снежно — и повод для игры, и повод согреться внутри" },
        { id: "snow_child_micro_4", text: "❄️ Сугробы зовут — но если устанет, найдём тёплое место рядом" },
        { id: "snow_child_micro_5", text: "⛄ Морозец — просто наденьте потеплее и выберите комфортный маршрут" },
        { id: "snow_child_micro_6", text: "🌨 Белым-бело — хочется чего-то волшебного для {childName}", usesChildName: true },
        { id: "snow_child_micro_7", text: "❄️ Снежная погода — хороший день для спокойных семейных планов" }
      ],
      titles: [
        { id: "snow_child_title_1", text: "Куда сегодня с {childName} — гулять или в тепло?", usesChildName: true },
        { id: "snow_child_title_2", text: "Зимний день без истерик — с запасным планом" },
        { id: "snow_child_title_3", text: "Найдём то, что зайдёт именно сейчас" },
        { id: "snow_child_title_4", text: "Снег — повод повеселиться, если не тянуть малыша на часы" },
        { id: "snow_child_title_5", text: "Выберем формат: коротко и ярко" },
        { id: "snow_child_title_6", text: "Соберём день так, чтобы {childName} не переохладился", usesChildName: true },
        { id: "snow_child_title_7", text: "Можно и покататься, и зайти погреться — как скажете вы" }
      ],
      subtitles: [
        { id: "snow_child_sub_1", text: "Есть места, где детям интересно и на улице, и внутри — рядом друг с другом" },
        { id: "snow_child_sub_2", text: "Смотри варианты по возрасту — без лишней суеты в переходах" },
        { id: "snow_child_sub_3", text: "Сохраняй понравившееся — пригодится, если погода резко поменяется" },
        { id: "snow_child_sub_4", text: "Если {childName} устал — обычно рядом есть куда зайти передохнуть", usesChildName: true },
        { id: "snow_child_sub_5", text: "Без давления «надо успеть всё» — один хороший кусочек дня тоже считается" },
        { id: "snow_child_sub_6", text: "Можно начать с простого: горячий напиток и спокойное занятие" },
        { id: "snow_child_sub_7", text: "Зимний день лучше складывается из маленьких приятных остановок" }
      ]
    },
    family: {
      microcopy: [
        { id: "snow_family_micro_1", text: "❄️ Снежный день — удобный повод собраться всем вместе" },
        { id: "snow_family_micro_2", text: "⛄ Зима щиплет носы — зато дома потом особенно уютно" },
        { id: "snow_family_micro_3", text: "🌨 Сугробы — и повод для смеха, и повод для тёплой паузы" },
        { id: "snow_family_micro_4", text: "❄️ Можно устроить день так, чтобы и малышам, и взрослым было ок" },
        { id: "snow_family_micro_5", text: "⛄ Снежно и красиво — хочется чего-то общего и спокойного" },
        { id: "snow_family_micro_6", text: "🌨 Белым-бело — самое время для семейного «давай без спешки»" },
        { id: "snow_family_micro_7", text: "❄️ Зимний день — не про скорость, а про то, чтобы всем было тепло на душе" }
      ],
      titles: [
        { id: "snow_family_title_1", text: "Соберём зимний день для всех возрастов" },
        { id: "snow_family_title_2", text: "Снежно снаружи — тепло внутри семьи" },
        { id: "snow_family_title_3", text: "Что сделаем вместе — гулять или уютно посидеть?" },
        { id: "snow_family_title_4", text: "Найдём баланс: никто не мёрзнет зря" },
        { id: "snow_family_title_5", text: "План на день без гонок и обид" },
        { id: "snow_family_title_6", text: "Зима — повод выбрать что-то общее и простое" },
        { id: "snow_family_title_7", text: "Можно совместить прогулку и тёплую остановку для всех" }
      ],
      subtitles: [
        { id: "snow_family_sub_1", text: "Здесь есть идеи, где удобно и детям побегать, и взрослым передохнуть" },
        { id: "snow_family_sub_2", text: "Смотри варианты рядом друг с другом — меньше суеты в дороге" },
        { id: "snow_family_sub_3", text: "Сохраняй то, что откликается всем — потом легче договориться" },
        { id: "snow_family_sub_4", text: "Без обещаний «идеальной зимы» — просто хороший общий день" },
        { id: "snow_family_sub_5", text: "Если кто-то устал — обычно рядом есть куда зайти погреться" },
        { id: "snow_family_sub_6", text: "Можно собрать день из двух коротких частей — это нормально" },
        { id: "snow_family_sub_7", text: "Главное — чтобы вечером было приятно вспоминать, а не отдыхать от плана" }
      ]
    }
  },

  hot_caution: {
    guest: {
      microcopy: [
        { id: "hot_guest_micro_1", text: "🌡 Жарковато — лучше не геройствовать на солнце целый день" },
        { id: "hot_guest_micro_2", text: "☀️ Солнце припекает — хочется тени, воды и спокойного темпа" },
        { id: "hot_guest_micro_3", text: "🌡 Жара — повод выбрать места с тенью и передышками" },
        { id: "hot_guest_micro_4", text: "🥤 Такая погода просит воды, головных уборов и коротких отрезков на улице" },
        { id: "hot_guest_micro_5", text: "☀️ Душно — зато можно устроить день с умными паузами" },
        { id: "hot_guest_micro_6", text: "🌡 Жаркий день — не про «успеть всё», а про комфорт" },
        { id: "hot_guest_micro_7", text: "☀️ Солнце щедрое — бережёмся и выбираем мягкий ритм" }
      ],
      titles: [
        { id: "hot_guest_title_1", text: "Соберём жаркий день без перегрева" },
        { id: "hot_guest_title_2", text: "Найдём тень, воду и спокойный маршрут" },
        { id: "hot_guest_title_3", text: "Жара — повод планировать с заботой о себе и детях" },
        { id: "hot_guest_title_4", text: "Что сделаем сегодня — без лишнего солнца в лоб" },
        { id: "hot_guest_title_5", text: "Выберем формат: короткие выходы и тёплые паузы" },
        { id: "hot_guest_title_6", text: "Давай без гонки — просто приятный день" },
        { id: "hot_guest_title_7", text: "Можно и на свежем воздухе, и в прохладе — как легче телу" }
      ],
      subtitles: [
        { id: "hot_guest_sub_1", text: "Есть места с тенью, с водой рядом и с возможностью передохнуть" },
        { id: "hot_guest_sub_2", text: "Смотри варианты, где не нужно стоять на солнце часами" },
        { id: "hot_guest_sub_3", text: "Сохраняй то, что кажется безопасным по ощущениям — жара у всех разная" },
        { id: "hot_guest_sub_4", text: "Без морали — просто идеи, как провести день мягче" },
        { id: "hot_guest_sub_5", text: "Можно совместить прогулку и прохладное помещение в одном районе" },
        { id: "hot_guest_sub_6", text: "Если устали — это сигнал перейти в тень, а не «дотерпеть»" },
        { id: "hot_guest_sub_7", text: "Детям особенно важны паузы — здесь это учтено в подборе" }
      ]
    },
    self: {
      microcopy: [
        { id: "hot_self_micro_1", text: "🌡 Жарко — давай без героизма, просто комфортный день" },
        { id: "hot_self_micro_2", text: "☀️ Солнце сильное — хочется тени и спокойного темпа" },
        { id: "hot_self_micro_3", text: "🌡 Жара — повод планировать с паузами и водой" },
        { id: "hot_self_micro_4", text: "🥤 Такой день лучше собирать из коротких выходов" },
        { id: "hot_self_micro_5", text: "☀️ Душно — и это нормально сбавить обороты" },
        { id: "hot_self_micro_6", text: "🌡 Припекает — выберем то, где можно передохнуть" },
        { id: "hot_self_micro_7", text: "☀️ Жаркая погода — не конкурс на выносливость" }
      ],
      titles: [
        { id: "hot_self_title_1", text: "Как проведём день, чтобы не перегреться?" },
        { id: "hot_self_title_2", text: "Подберём маршрут с тенью и передышками" },
        { id: "hot_self_title_3", text: "Жара — повод быть к себе и детям помягче" },
        { id: "hot_self_title_4", text: "Составим план без лишнего солнца" },
        { id: "hot_self_title_5", text: "Найдём прохладные и спокойные варианты" },
        { id: "hot_self_title_6", text: "Можно и на улице недолго, и внутри подольше" },
        { id: "hot_self_title_7", text: "День в жару — про заботу, не про рекорды" }
      ],
      subtitles: [
        { id: "hot_self_sub_1", text: "Собрала идеи, где легко сделать паузу и попить воды" },
        { id: "hot_self_sub_2", text: "Если устали — это не провал плана, а повод переключиться" },
        { id: "hot_self_sub_3", text: "Сохраняй варианты с тенью — пригодится в полдень" },
        { id: "hot_self_sub_4", text: "Без давления «надо успеть» — в жару лучше меньше, но приятнее" },
        { id: "hot_self_sub_5", text: "Можно совместить короткую прогулку и долгий отдых в прохладе" },
        { id: "hot_self_sub_6", text: "Выбирай по ощущениям: иногда лучше уют внутри, чем жара снаружи" },
        { id: "hot_self_sub_7", text: "Детям особенно важны переключения — здесь это можно учесть" }
      ]
    },
    child: {
      microcopy: [
        { id: "hot_child_micro_1", text: "🌡 Жарко — {childName} лучше не держать на солнце без пауз", usesChildName: true },
        { id: "hot_child_micro_2", text: "☀️ Солнце активное — зато можно найти тень и воду рядом" },
        { id: "hot_child_micro_3", text: "🌡 Жара — день из коротких весёлых кусочков, а не из марафона" },
        { id: "hot_child_micro_4", text: "🥤 Хочется пить чаще — это повод планировать спокойнее" },
        { id: "hot_child_micro_5", text: "☀️ Душно — можно устроить день с прохладными остановками" },
        { id: "hot_child_micro_6", text: "🌡 Такая погода любит тень, игры не на жаре и передышки" },
        { id: "hot_child_micro_7", text: "☀️ Жаркий день — не про «успеть всё», а про комфорт {childName}", usesChildName: true }
      ],
      titles: [
        { id: "hot_child_title_1", text: "Куда с {childName}, чтобы было прохладнее и веселее?", usesChildName: true },
        { id: "hot_child_title_2", text: "Жаркий день — с тенью и паузами" },
        { id: "hot_child_title_3", text: "Найдём формат без лишнего солнца" },
        { id: "hot_child_title_4", text: "Соберём день так, чтобы никто не перегрелся" },
        { id: "hot_child_title_5", text: "Можно коротко на улице — и дольше в прохладе" },
        { id: "hot_child_title_6", text: "Выберем спокойный ритм для малыша" },
        { id: "hot_child_title_7", text: "Жара — повод быть к детям помягче в планах" }
      ],
      subtitles: [
        { id: "hot_child_sub_1", text: "Есть места, где можно и побегать, и быстро зайти в тень" },
        { id: "hot_child_sub_2", text: "Смотри варианты с водой и отдыхом рядом — меньше тревоги" },
        { id: "hot_child_sub_3", text: "Сохраняй то, что кажется безопасным по самочувствию ребёнка" },
        { id: "hot_child_sub_4", text: "Без морали — просто идеи, как провести день мягче" },
        { id: "hot_child_sub_5", text: "Если {childName} устал — это сигнал сделать паузу, а не тянуть", usesChildName: true },
        { id: "hot_child_sub_6", text: "Можно совместить немного солнца и много прохлады" },
        { id: "hot_child_sub_7", text: "Жаркий день лучше складывается из маленьких приятных кусков" }
      ]
    },
    family: {
      microcopy: [
        { id: "hot_family_micro_1", text: "🌡 Жарко — соберём день так, чтобы всем было легче дышать" },
        { id: "hot_family_micro_2", text: "☀️ Солнце щедрое — хочется тени, воды и спокойного ритма для всех" },
        { id: "hot_family_micro_3", text: "🌡 Жара — повод договориться о паузах без упрёков" },
        { id: "hot_family_micro_4", text: "🥤 Такой день лучше делить на короткие выходы" },
        { id: "hot_family_micro_5", text: "☀️ Душно — можно выбрать маршрут с прохладными остановками" },
        { id: "hot_family_micro_6", text: "🌡 Жаркий день — про заботу, а не про «кто выдержит дольше»" },
        { id: "hot_family_micro_7", text: "☀️ Всем по-разному жарко — и это нормально учесть в плане" }
      ],
      titles: [
        { id: "hot_family_title_1", text: "Жаркий день всей семьёй — с тенью и передышками" },
        { id: "hot_family_title_2", text: "Найдём план, где удобно и детям, и взрослым" },
        { id: "hot_family_title_3", text: "Солнце сильное — давай без гонки" },
        { id: "hot_family_title_4", text: "Соберём день из коротких хороших кусочков" },
        { id: "hot_family_title_5", text: "Что сделаем сегодня — мягко и по-человечески?" },
        { id: "hot_family_title_6", text: "Жара — повод выбрать комфорт, а не рекорд" },
        { id: "hot_family_title_7", text: "Можно совместить немного улицы и много прохлады" }
      ],
      subtitles: [
        { id: "hot_family_sub_1", text: "Здесь есть варианты с тенью и с местом передохнуть всем вместе" },
        { id: "hot_family_sub_2", text: "Смотри идеи рядом — меньше переездов в жару" },
        { id: "hot_family_sub_3", text: "Сохраняй то, что откликается всем — проще договориться" },
        { id: "hot_family_sub_4", text: "Без идеального плана — просто день, где никто не таял зря" },
        { id: "hot_family_sub_5", text: "Если кто-то устал — это повод перейти в прохладу, а не спорить" },
        { id: "hot_family_sub_6", text: "Можно начать рано или ближе к вечеру — как удобнее телу" },
        { id: "hot_family_sub_7", text: "Главное — чтобы вечером не хотелось только отдыхать от жары" }
      ]
    }
  },

  unknown: {
    guest: {
      microcopy: [
        { id: "unk_guest_micro_1", text: "🌤 Какая сегодня погода — неважно: можно всё равно придумать хороший день" },
        { id: "unk_guest_micro_2", text: "☁️ Погода мелькнула и пропала — зато настроение можно выбрать самим" },
        { id: "unk_guest_micro_3", text: "🌈 День как день — зато впереди свобода выбрать, куда пойти" },
        { id: "unk_guest_micro_4", text: "🌤 Без прогноза на экране — просто посмотрим идеи рядом" },
        { id: "unk_guest_micro_5", text: "☁️ Не угадали погоду — не страшно, есть варианты на любой случай" },
        { id: "unk_guest_micro_6", text: "🌤 Сегодня можно не подстраиваться под небо — только под семью" },
        { id: "unk_guest_micro_7", text: "🌈 Спокойный старт: выберем что-то приятное без лишней суеты" }
      ],
      titles: [
        { id: "unk_guest_title_1", text: "Давай просто выберем, что хочется сегодня" },
        { id: "unk_guest_title_2", text: "Найдём идею на день — без привязки к облакам" },
        { id: "unk_guest_title_3", text: "Можно придумать план спокойно, без угадываний" },
        { id: "unk_guest_title_4", text: "Что сделаем сегодня — как скажете вы" },
        { id: "unk_guest_title_5", text: "Соберём день из того, что рядом и по душе" },
        { id: "unk_guest_title_6", text: "Посмотрим варианты в Минске — на любой вкус" },
        { id: "unk_guest_title_7", text: "Погода подождёт — а настроение можно поднять сейчас" }
      ],
      subtitles: [
        { id: "unk_guest_sub_1", text: "Здесь есть и прогулки, и занятия внутри — выбирай по настроению" },
        { id: "unk_guest_sub_2", text: "Сохраняй понравившееся — потом легче вернуться к выбору" },
        { id: "unk_guest_sub_3", text: "Без обещаний «идеальной погоды» — просто хорошие места рядом" },
        { id: "unk_guest_sub_4", text: "Можно начать с малого: один кусочек дня, который радует" },
        { id: "unk_guest_sub_5", text: "Смотри варианты для детей разного возраста — без лишнего шума" },
        { id: "unk_guest_sub_6", text: "Если планы поменяются — всегда есть запасной формат" },
        { id: "unk_guest_sub_7", text: "Главное — чтобы вечером было приятно, а не «как мы это выдержали»" }
      ]
    },
    self: {
      microcopy: [
        { id: "unk_self_micro_1", text: "🌤 Погода не подгрузилась — зато ты можешь выбрать день сама" },
        { id: "unk_self_micro_2", text: "☁️ Небо молчит — давай без догадок, просто по настроению" },
        { id: "unk_self_micro_3", text: "🌈 Сегодня можно не угадывать прогноз — только то, что хочется семье" },
        { id: "unk_self_micro_4", text: "🌤 Спокойный день начинается с простого выбора" },
        { id: "unk_self_micro_5", text: "☁️ Без погодного давления — просто идеи рядом" },
        { id: "unk_self_micro_6", text: "🌤 {userName}, давай выберем что-то без лишней суеты", usesName: true },
        { id: "unk_self_micro_7", text: "🌈 Можно и улица, и дом — как сегодня ощущается телу" }
      ],
      titles: [
        { id: "unk_self_title_1", text: "Что сегодня хочется — тихо или шумно?" },
        { id: "unk_self_title_2", text: "Соберём день без угадывания погоды" },
        { id: "unk_self_title_3", text: "Найдём вариант под твоё настроение" },
        { id: "unk_self_title_4", text: "План на сегодня — мягко и по делу" },
        { id: "unk_self_title_5", text: "Можно выбрать одно хорошее дело — и этого достаточно" },
        { id: "unk_self_title_6", text: "Давай без «надо успеть всё»" },
        { id: "unk_self_title_7", text: "Смотрим идеи — ты решаешь, что заходит" }
      ],
      subtitles: [
        { id: "unk_self_sub_1", text: "Собрала варианты на разный случай — если что, переключишься" },
        { id: "unk_self_sub_2", text: "Сохраняй то, что откликается — потом проще собрать неделю" },
        { id: "unk_self_sub_3", text: "Без навязчивых «лучших мест» — только то, что реально удобно" },
        { id: "unk_self_sub_4", text: "Если устали — это не провал, а сигнал сменить формат" },
        { id: "unk_self_sub_5", text: "Можно совместить короткую прогулку и спокойное занятие" },
        { id: "unk_self_sub_6", text: "Детям иногда нужен простой план — здесь такие тоже есть" },
        { id: "unk_self_sub_7", text: "День не обязан быть идеальным — достаточно тёплого воспоминания" }
      ]
    },
    child: {
      microcopy: [
        { id: "unk_child_micro_1", text: "🌤 Погода какая — неважно: главное, что рядом {childName}", usesChildName: true },
        { id: "unk_child_micro_2", text: "☁️ День как день — можно придумать что-то приятное для малыша" },
        { id: "unk_child_micro_3", text: "🌈 Сегодня можно выбрать без угадывания неба" },
        { id: "unk_child_micro_4", text: "🌤 Спокойно: посмотрим идеи, которые зайдут {childName}", usesChildName: true },
        { id: "unk_child_micro_5", text: "☁️ Без лишнего плана — просто хороший кусочек дня" },
        { id: "unk_child_micro_6", text: "🌤 Можно и погулять недолго, и зайти в тепло — как скажете вы" },
        { id: "unk_child_micro_7", text: "🌈 Маленький выбор иногда важнее большого прогноза" }
      ],
      titles: [
        { id: "unk_child_title_1", text: "Что сегодня с {childName} — спокойно и по душе?", usesChildName: true },
        { id: "unk_child_title_2", text: "Найдём идею без лишней суеты" },
        { id: "unk_child_title_3", text: "День для малыша — мягкий и посильный" },
        { id: "unk_child_title_4", text: "Можно одно хорошее занятие — и хватит" },
        { id: "unk_child_title_5", text: "Выберем формат, который не выматывает" },
        { id: "unk_child_title_6", text: "Погода подождёт — настроение важнее" },
        { id: "unk_child_title_7", text: "Смотрим варианты рядом — меньше дороги, больше спокойствия" }
      ],
      subtitles: [
        { id: "unk_child_sub_1", text: "Есть места, где детям интересно без марафона по городу" },
        { id: "unk_child_sub_2", text: "Сохраняй понравившееся — пригодится в спокойную минуту" },
        { id: "unk_child_sub_3", text: "Без давления «надо успеть» — один шаг дня тоже считается" },
        { id: "unk_child_sub_4", text: "Если {childName} устал — можно быстро сменить сцену", usesChildName: true },
        { id: "unk_child_sub_5", text: "Выбирай по возрасту — без лишних сложных переездов" },
        { id: "unk_child_sub_6", text: "Можно совместить прогулку и уютное занятие внутри" },
        { id: "unk_child_sub_7", text: "Главное — чтобы вечером было спокойно, а не «мы выжили»" }
      ]
    },
    family: {
      microcopy: [
        { id: "unk_family_micro_1", text: "🌤 Погода неважна — важно, что вы вместе" },
        { id: "unk_family_micro_2", text: "☁️ День без прогноза — зато можно выбрать по общему настроению" },
        { id: "unk_family_micro_3", text: "🌈 Сегодня можно не угадывать небо — только то, что хочется всем" },
        { id: "unk_family_micro_4", text: "🌤 Спокойный старт: один хороший план на семью" },
        { id: "unk_family_micro_5", text: "☁️ Без идеальной погоды — просто тёплый общий день" },
        { id: "unk_family_micro_6", text: "🌤 Можно устроить день из маленьких приятных кусочков" },
        { id: "unk_family_micro_7", text: "🌈 Главное — чтобы никому не пришлось геройствовать зря" }
      ],
      titles: [
        { id: "unk_family_title_1", text: "Что сегодня хочется всей семьёй?" },
        { id: "unk_family_title_2", text: "Найдём план без угадывания погоды" },
        { id: "unk_family_title_3", text: "Соберём день спокойно и по-человечески" },
        { id: "unk_family_title_4", text: "Можно выбрать одно общее дело — и этого достаточно" },
        { id: "unk_family_title_5", text: "Давай без гонки — просто хорошее время вместе" },
        { id: "unk_family_title_6", text: "Посмотрим варианты, где удобно всем возрастам" },
        { id: "unk_family_title_7", text: "Погода какая угодно — настроение можно поднять сейчас" }
      ],
      subtitles: [
        { id: "unk_family_sub_1", text: "Здесь есть идеи, где легко договориться без споров о маршруте" },
        { id: "unk_family_sub_2", text: "Сохраняй то, что откликается разным членам семьи — проще потом" },
        { id: "unk_family_sub_3", text: "Без обещаний идеального дня — просто хороший общий вечер" },
        { id: "unk_family_sub_4", text: "Можно совместить короткую прогулку и уютную паузу" },
        { id: "unk_family_sub_5", text: "Если кто-то устал — это повод сменить формат, а не винить" },
        { id: "unk_family_sub_6", text: "Выбирайте по душе — не по «как надо»" },
        { id: "unk_family_sub_7", text: "Главное — чтобы потом было приятно вспоминать, а не отдыхать от плана" }
      ]
    }
  }
}