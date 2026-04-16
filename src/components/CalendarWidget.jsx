import React from 'react';
import { Button } from 'antd';

const CalendarWidget = () => {
  const days = [
    { date: 13, day: 'ПН', hasEvent: false },
    { date: 14, day: 'ВТ', hasEvent: true },
    { date: 15, day: 'СР', hasEvent: true, selected: true },
    { date: 16, day: 'ЧТ', hasEvent: false },
    { date: 17, day: 'ПТ', hasEvent: false },
    { date: 18, day: 'СБ', hasEvent: false },
    { date: 19, day: 'ВС', hasEvent: false },
  ];

  return (
    <div className="calendar-widget">
      <div className="calendar-header">
        <h2>План на завтра, 15 апреля</h2>
        <p>Для Степана в Минске</p>
      </div>

      <div className="calendar-days">
        {days.map((day) => (
          <div
            key={day.date}
            className={`calendar-day ${day.selected ? 'selected' : ''}`}
            style={{
              position: 'relative',
              height: day.selected ? '70px' : '60px', // 动态设置高度
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="day-name">{day.day}</span>
            <span className="day-number">{day.date}</span>
            {/* 使用绝对定位的小圆点，避免影响布局 */}
            {day.hasEvent && (
              <div
                className="event-dot"
                style={{
                  position: 'absolute',
                  bottom: '8px', // 调整位置以适应新高度
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#333',
                  opacity: 0.8,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarWidget;