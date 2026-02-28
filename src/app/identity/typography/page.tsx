import { 
  H1, 
  H2, 
  H3, 
  H4, 
  Body, 
  BodyMuted, 
  Caption, 
  Label, 
} from "@/components/ui/typography" 

export default function IdentityTypographyPage() { 
  return ( 
    <main className="mx-auto max-w-4xl p-8 space-y-12"> 

      <section className="space-y-2"> 
        <H1>Айдентика mamaGo</H1> 
        <BodyMuted>Типографика интерфейса</BodyMuted> 
      </section> 

      <section className="space-y-6"> 
        <H2>Заголовки</H2> 

        <div className="space-y-4"> 
          <H1>Куда сходить с ребёнком в Минске</H1> 
          <H2>Лучшие варианты на выходные</H2> 
          <H3>Робопарк: выставка роботов</H3> 
          <H4>Возраст 4–12 лет</H4> 
        </div> 
      </section> 

      <section className="space-y-6"> 
        <H2>Карточка активности</H2> 

        <div className="rounded-2xl border p-5 space-y-3 max-w-sm"> 
          <H3>Робопарк: выставка роботов</H3> 

          <div className="flex gap-3"> 
            <Caption>4–12 лет</Caption> 
            <Caption>11:00–19:00</Caption> 
          </div> 

          <Body> 
            Интерактивная выставка с роботами, VR-зонами и мастер-классами 
            по программированию для детей. 
          </Body> 

          <BodyMuted>ТРЦ Palazzo</BodyMuted> 

          <Body>от 25 BYN</Body> 
        </div> 
      </section> 

      <section className="space-y-4 max-w-2xl"> 
        <H2>Длинный текст</H2> 

        <Body> 
          Родителям важно быстро понять подходит ли активность их ребенку. 
          Поэтому текст должен легко сканироваться. 
        </Body> 

        <Body> 
          Главная цель mamaGo — принять решение за 10–15 секунд. 
        </Body> 
      </section> 

      <section className="space-y-4"> 
        <H2>Подписи интерфейса</H2> 

        <div className="flex gap-6 items-center"> 
          <Label>Куда пойти</Label> 
          <Label>Занятия</Label> 
          <Label>Детский праздник</Label> 
        </div> 

        <div className="flex gap-6 items-center"> 
          <Caption>Сегодня</Caption> 
          <Caption>Завтра</Caption> 
          <Caption>Выходные</Caption> 
        </div> 
      </section> 

    </main> 
  ) 
} 
