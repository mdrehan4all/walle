import { Component, OnInit } from '@angular/core';
import { merge, Observable, Subject } from 'rxjs';
import { map, tap, debounceTime, takeUntil } from 'rxjs/operators';
import {
	ListeningStarted,
	SpeakingStarted,
	RecognizedTextAction,
} from '../../classes/models';
import { SenseService } from '../sense.service';

@Component({
  selector: 'app-bot',
  templateUrl: './bot.component.html',
  styleUrls: ['./bot.component.scss']
})
export class BotComponent implements OnInit {

  ngOnInit(): void {
  }

  destroy$ = new Subject();

	recognized$ = this.senseService.getType(RecognizedTextAction);
	state$: Observable<string>;
	message$: Observable<string>;

	micAccess$ = this.senseService.hasMicrofonAccess$;

	constructor(private senseService: SenseService) {
		this.message$ = this.recognized$.pipe(tap(console.log));

		const speaking$ = this.senseService
			.getType(SpeakingStarted)
			.pipe(map(() => 'SPEAKING'));

		const listening$ = this.senseService
			.getType(ListeningStarted)
			.pipe(map(() => 'LISTENING'));

		this.state$ = merge(speaking$, listening$);

		this.recognized$
			.pipe(
				debounceTime(200),
				tap((msg) => {
					// msg = `you said ${msg}`;
					this.senseService.speak(msg);
				}, takeUntil(this.destroy$))
			)
			.subscribe();
	}

	getImageClass() {
		return {
			image: true,
		};
	}

	ngOnDestroy() {
		//this.destroy$.next();
		this.destroy$.complete();
	}

	activate() {
		this.senseService.activate();
	}

}
