# Article geo-scope owner review — 107 articles (2026-08-15)

Editorial recommendations for owner approval — **not automatic migration
evidence**. No Article.geoScope/cityId was written by this task. Full data
(all columns, ownerDecision/ownerCity/ownerNote to fill in) is in
`article-geoscope-owner-review-2026-08-15.csv`. This file has recommendation
context only, no full article bodies.

Final URL contract: GLOBAL → `/blog/{slug}`, CITY → `/{city}/blog/{slug}`
(current city corpus: Minsk only).

Summary: CITY_MINSK 71 / GLOBAL 15 / UNCLEAR 21.
Confidence: HIGH 57 / MEDIUM 43 / LOW 7.
Owner must inspect carefully (UNCLEAR + LOW + any flagged): **39**.
Bulk-approval candidates (HIGH confidence, no special flag) — shown as counts only, not auto-approved: CITY_MINSK 40, GLOBAL 9.

## A. NEEDS CAREFUL REVIEW (UNCLEAR, LOW confidence, or flagged mixed/special cases) — 39

| Legacy ID | Title | Recommendation | Confidence | Reason | Flag |
|---|---|---|---|---|---|
| 10727 | Аквапарк в Молодечно и вкуснющщщие бургеры. | UNCLEAR | MEDIUM | Explicitly about a waterpark trip to Molodechno, not Minsk — Minsk is mentioned only as the contrasting starting point. | MIXED_MINSK_BELARUS |
| 13373 | Хьюстон, у нас каникулы в феврале! | UNCLEAR | MEDIUM | February break activities mixing a specific camp with generic 'variant' options; geo signal shows Molodechno, not clearly Minsk. | MIXED_MINSK_BELARUS |
| 18618 | Детские летние лагеря 2024 загородные | UNCLEAR | MEDIUM | Out-of-town/country camps listicle — explicitly not city-based (Belarus-wide camp locations), though MamaGo itself is Minsk-based. | MIXED_MINSK_BELARUS |
| 19660 | Маша Гурбанова: любимые места... | UNCLEAR | MEDIUM | Personal 'favorite places' interview naming Grodno and general Belarus venues, not Minsk specifically. | MIXED_MINSK_BELARUS |
| 20214 | 100 классных идей, как провести время ярко и необычно всей семьей | UNCLEAR | LOW | 100 generic family activity ideas; empty body and mixed geo signals (Minsk, Brest, Molodechno) prevent confident single-city classification. | MIXED_MINSK_BELARUS |
| 23812 | Спортивные кружки и секции для детей в Минске | UNCLEAR | MEDIUM | AMBIGUOUS WP — flagged explicitly for owner review, not silently auto-approved. Title says 'в Минске' and lists many named sports schools; 3 of 12 relation-evidence Places resolved to Minsk and 9 unresolved — strong CITY_MINSK signal but incomplete relational confirmation. | AMBIGUOUS_RELATIONS;SOFT_SLUG_MISMATCH |
| 28546 | ТОП идей, что подарить маме на День матери: интересные и оригинальные подарки про эмоции. | UNCLEAR | LOW | Generic Mother's Day gift-idea listicle; some entries may reference local services but framing is not Minsk-specific. | SOFT_SLUG_MISMATCH |
| 30049 | Гайд: готовимся к Тыквенному Спасу! | UNCLEAR | MEDIUM | Halloween-adjacent holiday prep guide mixing generic costume/decor tips with a 'where to go' section. | SOFT_SLUG_MISMATCH |
| 33172 | Зимние каникулы: куда пристроить детей? | UNCLEAR | MEDIUM | Listicle of named children's clubs/camps; genre matches Minsk-club roundups but geo signals mix Minsk and Molodechno with no clear single-city framing. | MIXED_MINSK_BELARUS |
| 35329 | Чем заняться в остаток каникул и где отпраздновать Рождество | UNCLEAR | MEDIUM | Christmas holiday guide with a mix of 'out of town' and generic tips; named Belarus-wide attractions (Дукорский маёнтак, Станьково) rather than purely Minsk-city venues. | MIXED_MINSK_BELARUS |
| 40724 | Весенние каникулы 2026: чем заняться и куда отправить детей | UNCLEAR | MEDIUM | Spring break activities listicle naming specific venues (VR arena, Disco Park) but geo signals mix Minsk, Molodechno and general Belarus. | MIXED_MINSK_BELARUS |
| 41510 | Лето 2026: загородный и городской отдых для детей | UNCLEAR | MEDIUM | Summer camps roundup explicitly covering both 'загородный и городской' (out-of-town and city) options; empty body limits full assessment. | MIXED_MINSK_BELARUS |
| 62132 | Любимые места в Гродно и в окрестностях: на машине или автодоме | UNCLEAR | MEDIUM | Travel guide to Grodno and surroundings — explicitly about a different Belarusian city, not Minsk; empty body limits full assessment. Owner should decide whether this becomes a national-scope article or needs separate handling. | MIXED_MINSK_BELARUS;OTHER_REVIEW |
| 12256 | Ленивые развлечения или чем заняться на праздники | UNCLEAR | LOW | Generic 'lazy holiday activities at home' ideas (YouTube, board games); no venue dependency despite a detected Minsk geo tag. |  |
| 13288 | Где оставить ребенка с няней на час | UNCLEAR | MEDIUM | Listicle of specific named childcare venues, but framing ('где оставить ребенка с няней') is a generic parenting need with local examples. |  |
| 13873 | Идеи на 8 Марта | UNCLEAR | LOW | Generic March 8th gift-idea packages; no clear venue dependency evident in the excerpt despite a detected Minsk geo tag. |  |
| 16094 | День рождения ребенка 8 лет. Сколько стоит? | UNCLEAR | MEDIUM | Personal birthday cost breakdown; genre matches Minsk venue reviews but no explicit venue/city named in this excerpt. |  |
| 16810 | Выпускной в детском саду или школе. Где отметить? | UNCLEAR | LOW | Graduation party venue listicle with named clubs; empty body and a Ratomka geo signal (a Minsk-area village) limit confident assessment. |  |
| 19119 | Беседки для дня рождения на природе | UNCLEAR | MEDIUM | Listicle of specific named gazebo/venue rentals, but locations are countryside resorts rather than clearly Minsk-city venues. |  |
| 19544 | Чем заняться в большие выходные | UNCLEAR | LOW | Generic long-weekend activity ideas; mentions specific venues (Grill Manero, boat rentals) suggesting Minsk but framing is a broad 'ideas' listicle. |  |
| 57731 | Уютные каникулы всей семьей: чем заняться и как провести зимние вечера дома | UNCLEAR | LOW | Cozy family evening ideas (board games); no explicit venue/city dependency, and empty body limits assessment. |  |
| 10679 | Ракета «Пуговка 3.0» запущена покорять космос | CITY_MINSK | MEDIUM | Opening recap of a specific named local kids' club chain ('Пуговка') branch; content-relation evidence links to Places records, but city is unresolved by the automated audit. | OTHER_REVIEW |
| 18687 | Пасха 2025 в Беларуси: гайд от команды mamaGo | GLOBAL | MEDIUM | Title says 'в Беларуси' (nationwide); Easter guide content (traditions, recipes, kids activities) is largely generic/national in this excerpt. | MIXED_MINSK_BELARUS |
| 19199 | Самая большая ЧЕТВЁРТАЯ «Пуговка» Центр | CITY_MINSK | MEDIUM | Opening recap of a specific venue chain branch ('Пуговка') at a Minsk address (ул.Тимирязева, 10). | OTHER_REVIEW |
| 19826 | Празднуем окончание учебного года всей семьей | CITY_MINSK | MEDIUM | End-of-school-year activity listicle naming a specific Minsk venue (Футбольный манеж, пр-т Победителей) though geo signals also include Ratomka/Marina Gorka. | MIXED_MINSK_BELARUS |
| 24772 | Детская зона MamaGo на фестивале Pets Fest | CITY_MINSK | MEDIUM | MamaGo's own event booth recap at Lakeside Park, a specific Minsk-area venue; local but a recap/thank-you post rather than a guide. | OTHER_REVIEW |
| 32082 | Детская зона MamaGo на фестивале огня Феникс | CITY_MINSK | MEDIUM | MamaGo's own event booth recap at Minsk's Botanical Garden; local but a recap post. | OTHER_REVIEW |
| 33899 | Новогодний гайд: куда пойти на зимних каникулах и где отметить Новый год с детьми | CITY_MINSK | MEDIUM | New Year guide listing specific Minsk landmarks (ГУМ department store, Коммунарка) though title doesn't name the city. | SOFT_SLUG_MISMATCH |
| 49590 | Nomad Houses Ферма. | GLOBAL | MEDIUM | Travel review of a rural retreat (Nomad Houses Ферма) near Braslav — explicitly not Minsk, a countryside destination article. | MIXED_MINSK_BELARUS |
| 54929 | Как и куда отправить письмо Деду Морозу или Санта Клаусу | GLOBAL | MEDIUM | How to send a letter to Santa/Ded Moroz — a general seasonal activity guide with no city dependency, phrased for families of Belarus generally. | MIXED_MINSK_BELARUS |
| 62336 | Куда сходить и чем удивить 14-го февраля: идеи подарков про эмоции на День Валентина до 100 BYN | CITY_MINSK | MEDIUM | Valentine's Day gift/date ideas naming specific venues; geo signal mixes Минск and Гродно but most named activities appear Minsk-based. | MIXED_MINSK_BELARUS |
| 21537 | ТОП-18 кафе и ресторанов с детской площадкой или комнатой | CITY_MINSK | HIGH | Title scoped 'в пределах Минска и до 10 км от него' explicitly; restaurant listicle with named venues. | SOFT_SLUG_MISMATCH |
| 21932 | 10 парков для активного отдыха и развлечений в Минске | CITY_MINSK | HIGH | Title explicitly 'в Минске'; named park listicle. | SOFT_SLUG_MISMATCH |
| 22603 | Любимые детские клубы-кофейни и игровые Минска | CITY_MINSK | HIGH | Title explicitly 'Минска'; named kids' cafe/club listicle. | SOFT_SLUG_MISMATCH |
| 24695 | Творческие, музыкальные и языковые кружки и секции для детей в Минске | CITY_MINSK | HIGH | Curated list of real, named Minsk children's clubs/studios; title also explicitly says Минск. | SOFT_SLUG_MISMATCH |
| 27355 | 4.8 млн.$ за первый детский сад «Северного берега»  | CITY_MINSK | HIGH | News about a new kindergarten in Severny Bereg, a specific Minsk development. | SOFT_SLUG_MISMATCH |
| 30642 | «Мама, я сам. Ферма» — лучшее место для всей семьи | CITY_MINSK | HIGH | Opening announcement for a specific named venue in Lebyazhy (Minsk area). | SOFT_SLUG_MISMATCH |
| 31021 | Где отметить день рождения в крытом парке: 10 классных парков развлечений для праздника | CITY_MINSK | HIGH | Listicle of ten specific named entertainment parks that recur across this corpus as known Minsk venues, despite no city name in the title. | SOFT_SLUG_MISMATCH |
| 34363 | Новогодние фотозоны Минска 2025/2026 | CITY_MINSK | HIGH | Title 'Новогодние фотозоны Минска' explicitly names Minsk; listicle of specific named local photo spots. | SOFT_SLUG_MISMATCH |

## B. MEDIUM CONFIDENCE (no special flag) — 19

| Legacy ID | Title | Recommendation | Confidence | Reason | Flag |
|---|---|---|---|---|---|
| 11112 | Дом Рождества — полное погружение | CITY_MINSK | MEDIUM | Review of the 'Дом Рождества' immersive exhibit at Дворец искусств, a specific Minsk venue. |  |
| 11948 | Начало зимних каникул в «Песочнице» | CITY_MINSK | MEDIUM | Review of a specific venue at a named Minsk address (Куйбышева, 45). |  |
| 12229 | Выставка «ЛЕГОУ»: РАЗОБЛАЧЕНИЕ | CITY_MINSK | MEDIUM | Review of a specific exhibit at ТРЦ Palazzo, a named Minsk mall. |  |
| 12464 | Первый раз в первый класс: где успеть подготовить ребёнка к школе | CITY_MINSK | MEDIUM | Curated list of named school-prep centers with 8 linked Place records; content-relation evidence present though city unresolved by the automated audit. |  |
| 13071 | Где отметить день рождения ребенка 7+ в Минске | CITY_MINSK | MEDIUM | Title explicitly 'в Минске'; venue listicle, though body is empty in this extract (7 linked Place relations present). |  |
| 13194 | Обновленная «Мистерия» — место для всей семьи от 0 до 99 | CITY_MINSK | MEDIUM | Review of a specific venue ('Мистерия') that relocated within Minsk (Сухарево). |  |
| 14483 | Идеи на весну или 27 дел, которые нужно успеть сделать до лета | GLOBAL | MEDIUM | General springtime bucket-list ideas (evening city walk, park reading); broadly applicable, though one item namechecks a specific museum. |  |
| 15608 | Детские лагеря 2024 на весенних каникулах | CITY_MINSK | MEDIUM | Spring break camps listicle naming a Minsk-branded program ('Научный Минск') and city/country options explicitly. |  |
| 18570 | Детские летние лагеря 2024 городские | CITY_MINSK | MEDIUM | Summer camps listicle naming '5 филиалах Минска' (5 Minsk branches) explicitly for the flagship camp. |  |
| 22774 | Кукурузный лабиринт «Кукуполис»: когда открытие? | CITY_MINSK | MEDIUM | Review of a specific seasonal attraction (corn maze); location context implies a specific local venue though not named explicitly in this excerpt. |  |
| 23778 | Как отметить детский день рождения летом? | CITY_MINSK | MEDIUM | Personal birthday review of a specific venue (aquazone at cafe 'Птичь'). |  |
| 24774 | Тае 10 лет: как отметить и сколько стоит день рождения ребёнка анлим | CITY_MINSK | MEDIUM | Personal birthday story centered on a specific real venue (Astoria), but framed as a family anecdote rather than a guide. |  |
| 25431 | МОДНЫЙ КВАРТАЛ: подготовка ребенка к школе бюджетно | CITY_MINSK | MEDIUM | Back-to-school shopping guide naming a specific Minsk shopping area (Ждановичи); body text is partially corrupted/truncated with tracking metadata. |  |
| 48659 | «Птичий дом» в Зеленой гавани: первый детский сад в жилом комплексе, где природа встречает детство | CITY_MINSK | MEDIUM | Review of a specific new kindergarten in a named residential development ('Зеленая гавань'), a Minsk-area complex matching similar articles in this corpus. |  |
| 51073 | Что подарить на День матери: идеи от команды MamaGo и блогеров | GLOBAL | MEDIUM | Generic Mother's Day gift ideas from the team/bloggers; no venue dependency evident, general listicle format. |  |
| 51263 | Чем заняться на осенних каникулах | CITY_MINSK | MEDIUM | Autumn break activities naming specific venues (Неон Парк, ЖК Маяк Минска, ТЦ Червенский) — Minsk-based venue routes, though body excerpt is truncated. |  |
| 56250 | Чем заняться на зимних каникулах | CITY_MINSK | MEDIUM | Winter break activity listing named local venues (Aktivdeti.by, Экопарк Акварель) in/near Minsk (Ratomka, Marina Gorka); empty body limits full assessment. |  |
| 58101 | Создательница Las Legas и Photohub Надежда Соловьева | CITY_MINSK | MEDIUM | Profile of a Minsk-based entrepreneur (Las Legas, PhotoHub — well-known Minsk businesses she founded); content centers on her local ventures. |  |
| 63859 | Девичник: идеи для мероприятия в женской компании или девочкового дня рождения  | GLOBAL | MEDIUM | General ideas for a girls'-night gathering (games, conversation topics); no venue dependency evident in the excerpt. |  |

## C. HIGH CONFIDENCE — CITY_MINSK (no special flag) — 40

| Legacy ID | Title | Recommendation | Confidence | Reason | Flag |
|---|---|---|---|---|---|
| 9704 | «Гранд Бублик» - просто ожившая усадьба Гэтсби и отель Гранд Будапешт. | CITY_MINSK | HIGH | Review of one specific venue (Гранд Бублик, Братская 6А, ЖК Минск-Мир) with prices and address — the content is the venue itself. |  |
| 11776 | Новогодний маршрут семейной прогулки | CITY_MINSK | HIGH | Explicit walking route through named central Minsk landmarks (Парк Горького, Октябрьская площадь) for the holidays. |  |
| 12106 | Где провести семейную фотосессию? | CITY_MINSK | HIGH | Listicle of specific named Minsk shopping malls (Galileo, Galleria, Palazzo, Титан, Dana Mall) for holiday photos. |  |
| 12348 | Нормально нереально: куда пойти за новыми ощущениями в Минске — «Мир иллюзий» | CITY_MINSK | HIGH | Title explicitly 'в Минске'; review of a specific exhibit venue ('Мир иллюзий'). |  |
| 12372 | MiMiLand: как мы выигрывали огромного Ститча за 10 руб | CITY_MINSK | HIGH | Review of a specific venue (Mi Mi Land) at a named Minsk mall (ТРЦ Palazzo); explicitly notes 'в Минске аналогов пока нет'. |  |
| 12392 | «Мама, ЯСам» — в Минске открылась огромная крытая песочница со спецтехникой | CITY_MINSK | HIGH | Title explicitly 'в Минске'; review of a specific new venue. |  |
| 12637 | Самый большой выбор сырников в Минске | CITY_MINSK | HIGH | Title explicitly 'в Минске'; review of one specific cafe in central Minsk. |  |
| 12891 | Где маме спокойно попить кофе: новые игровые Минска | CITY_MINSK | HIGH | Title explicitly 'Минска'; curated list of named local kids' cafes/clubs. |  |
| 12964 | Где подают трендовых котиков из TikTok | CITY_MINSK | HIGH | Review of one specific named venue (Шедевры вкуса) at a named Minsk address (Победителей 133). |  |
| 13429 | Новый Hero Park на Академии наук или батуты для малышей | CITY_MINSK | HIGH | Review of a specific venue (Hero Park) at named Minsk addresses (Сурганова, Дзержинского). |  |
| 13458 | Фитнес с детьми в Минске | CITY_MINSK | HIGH | Title explicitly 'в Минске'; listicle of named local fitness clubs with an address given (ул. Ратомская, 7). |  |
| 17106 | Где устроить пикник в Минске | CITY_MINSK | HIGH | Title explicitly 'в Минске'; picnic spot listicle with specific named Minsk parks. |  |
| 18366 | Экотропы  | CITY_MINSK | HIGH | Ecotrail listicle explicitly 'Минска (и не только)'; named specific trails mostly in/near the city. |  |
| 18509 | Клуб-кофейня «Ладушки»: попить кофе, поработать, пока ребёнок играет | CITY_MINSK | HIGH | Review of a specific venue chain ('Ладушки') with an explicit count of Minsk locations ('во всём Минске — аж 25'). |  |
| 18787 | Новая рубрика! MamaGoсти: любимые места Тани Шаповаловой | CITY_MINSK | HIGH | Personal 'favorite places' interview naming specific real Minsk streets/venues (Раковская, Дрозды, KaliLaska). |  |
| 19173 | Парки аттракционов в Минске: сезон открыт!  | CITY_MINSK | HIGH | Title explicitly 'в Минске'; review of specific named city parks (Парк Горького, Парк Челюскинцев). |  |
| 20955 | Ольга Жадеева: любимые места… | CITY_MINSK | HIGH | Personal 'favorite places' interview naming specific real Minsk neighborhoods/streets (Лебяжий, Осмоловка, Раковская). |  |
| 21827 | Чем занять подростка: 10 совместных дней летом в Минске | CITY_MINSK | HIGH | Title explicitly 'летом в Минске'; teen activity listicle. |  |
| 23191 | Любимые пляжи и открытые бассейны в Минске и неподалёку  | CITY_MINSK | HIGH | Title explicitly 'в Минске'; named beach/pool listicle (Минское море, Дрозды). |  |
| 24988 | Первая в Беларуси Школа талантов в Новой Боровой  | CITY_MINSK | HIGH | New school opening in Novaya Borovaya, a Minsk residential development — a specific local venue/project. |  |
| 26605 | Куда сходить в Минске: новые места лета 2024 | CITY_MINSK | HIGH | Title explicitly 'in Minsk'; curated list of named local cafes/restaurants. |  |
| 30700 | 7 идей куда сходить с ребенком на осенних каникулах в Минске | CITY_MINSK | HIGH | Title explicitly 'in Minsk'; listicle of activities for kids on autumn break. |  |
| 34997 | Куда сходить в Минске: новые места осени 2024 | CITY_MINSK | HIGH | Title 'Куда сходить в Минске' explicit; listicle of specific new local venues. |  |
| 36845 | Бассейны Минска и не только или аквазоны на все случаи жизни | CITY_MINSK | HIGH | Title explicitly 'Минска'; pool/aquazone listicle with named venues, though empty body in this excerpt. |  |
| 39844 | Детский сад «Кубики» в стиле Lego в Минске. Скоро... | CITY_MINSK | HIGH | Title says 'в Минске'; news about a specific new kindergarten in Novaya Borovaya. |  |
| 40994 | Где отпраздновать выпускной 2026 в детском саду и школе | CITY_MINSK | HIGH | Named graduation-party venue listicle (Neon Park, Golf Park etc.) matching the recurring Minsk-venue genre. |  |
| 45861 | Куда сходить с ребенком в Минске в День защиты детей 1 июня | CITY_MINSK | HIGH | Title explicitly 'в Минске'; June 1st events guide tied to the city's events calendar. |  |
| 46170 | Машины Помощники. В Минске открылся детский город профессий | CITY_MINSK | HIGH | Title explicitly 'в Минске'; review of one specific new venue. |  |
| 46879 | Инстаграмные катамараны в Дроздах. | CITY_MINSK | HIGH | Review of a specific venue (catamaran rental) at a named Minsk landmark (Дрозды). |  |
| 47505 | Как отметить детский день рождения: 10 идей для необычного праздника | CITY_MINSK | HIGH | Birthday-idea listicle of specific named local venues (aquazone Птичь, конная усадьба Буцевичи). |  |
| 47654 | Новая зона отдыха «Гармония и город» | CITY_MINSK | HIGH | Explicitly names a Minsk district (Советский район города Минска) for a new recreation area. |  |
| 49011 | Кружки и секции для детей в Минске. Набор 2025-2026. | CITY_MINSK | HIGH | Title explicitly 'в Минске'; named clubs/studios listicle. |  |
| 50093 | «Путь.Напряжение»: уникальная медиа-выставка в Минске, где искусство оживает | CITY_MINSK | HIGH | Title explicitly 'в Минске'; review of a specific named exhibit venue (Дом Экспериментального Искусства DEI). |  |
| 50174 | Лошицкий парк после реконструкции — в топ любимых мест для прогулок! | CITY_MINSK | HIGH | Review of a specific named Minsk park (Лошицкий парк) with exact directions. |  |
| 52296 | 3 самые красивые осенние фотолокации в Минске. Выбор мамагоу  | CITY_MINSK | HIGH | Explicit 'в Минске' in title; photo walk through specific named Minsk streets/venues with a local business partner. |  |
| 54146 | Новый год 2026 или куда сходить на новогодних каникулах в Минске | CITY_MINSK | HIGH | Title explicitly 'в Минске'; New Year events roundup for the city. |  |
| 60578 | Масленица 2026 в Минске — куда пойти с детьми и где отметить праздник | CITY_MINSK | HIGH | Title and body both explicitly 'в Минске'; Maslenitsa events guide for the city. |  |
| 63551 | Топ 9 добрых и теплых семейных квестов Минска. | CITY_MINSK | HIGH | Title explicitly 'Минска'; quest-room listicle in partnership with a Minsk business (extrareality.by). |  |
| 64406 | Иван Купала 2026 или где отметить Купалье в Минске и за городом. | CITY_MINSK | HIGH | Title explicitly 'в Минске'; Ivan Kupala event guide for the city and surroundings. |  |
| 64522 | Лебяжий на велосипеде: 6 классных остановок и ни одного «я устал» | CITY_MINSK | HIGH | Bike route review of a specific named Minsk district (Лебяжий) with landmarks along the way. |  |

## D. HIGH CONFIDENCE — GLOBAL (no special flag) — 9

| Legacy ID | Title | Recommendation | Confidence | Reason | Flag |
|---|---|---|---|---|---|
| 12841 | Как организовать детский день рождения дома без карты рассрочки и продажи почки? | GLOBAL | HIGH | General DIY birthday party ideas that work anywhere (concert-at-home, scavenger hunt, cooking party); no venue dependency. |  |
| 12957 | Как выбирают семейный отдых разные знаки зодиака | GLOBAL | HIGH | Astrology-themed listicle about how each zodiac sign vacations; no venue or city dependency. |  |
| 13584 | Детские истерики в полнолуние | GLOBAL | HIGH | General parenting/psychology musing about kids and full moons; no venue or city dependency. |  |
| 18252 | Пранки на 1 апреля | GLOBAL | HIGH | Generic April Fools' prank ideas; no venue or city dependency. |  |
| 18774 | Детский День рождения на природе: 5 простых, но зашибенных сценариев. | GLOBAL | HIGH | General outdoor birthday party scenario ideas (retro games, scavenger hunt); no venue dependency. |  |
| 26068 | «День ДА»: сколько стоит и зачем нужен день вседозволенности в семье | GLOBAL | HIGH | General parenting tradition/ritual concept inspired by a film; no venue or city dependency. |  |
| 52193 | Как отпраздновать Хэллоуин 2025 | GLOBAL | HIGH | Generic Halloween celebration guide (history, decor ideas, costume tips) with no venue or city dependency in the excerpt. |  |
| 55916 | Безопасность детей в сети | GLOBAL | HIGH | General online child-safety advice (grooming, phishing, deepfakes); no venue or city dependency. |  |
| 64460 | 13 ситуаций, в которых не нужно тревожиться вдали от больницы, и что положить в дачную аптечку | GLOBAL | HIGH | General child first-aid/health advice for dacha/countryside situations; no venue or city dependency. |  |
