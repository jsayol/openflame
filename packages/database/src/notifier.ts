import { DataListener, EventType } from './database-internal';
import { DataSnapshot } from './data-snapshot';
import { DataModel } from './data-model';
import { Path } from './path';
import { Subject } from 'rxjs/Subject';
import { Observable, ObservableInput } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/share';

/**
 * @internal
 */
export class Notifier {
  private _subject = new Subject<NotifierEvent>();

  forListener(listener: DataListener, mergeWith?: ObservableInput<NotifierEvent>): Observable<DataSnapshot> {
    let notifier$ = this._subject.asObservable();

    if (mergeWith) {
      notifier$ = notifier$.merge(mergeWith);
    }

    return notifier$
      .filter((event: NotifierEvent): boolean => {
        // TODO: take query options into account

        return (!event.tag || (event.tag === listener.tag))
          && (event.type === listener.type)
          && listener.query.path.isEqual(event.path);
      })
      .map((event: NotifierEvent): DataSnapshot => new DataSnapshot(listener.query, event.model));
  }

  trigger(path: Path,
          oldModel: DataModel,
          newModel: DataModel,
          tag = 0,
          bubbleUp = false,
          downLevels = Infinity,
          _subject?: Subject<NotifierEvent>) {

    if (newModel.hasChildren()) {
      if (downLevels > 0) {
        downLevels -= 1;

        newModel.forEachChild((key: string, child: DataModel) => {
          const childPath = path.child(key);
          this.trigger(childPath, oldModel.child(childPath), child, tag, false, downLevels);
        });
      }
    }

    // In general we emit on the notifier's subject, but in some cases we want to emit on some other subject
    const subject = _subject || this._subject;

    // TODO: detect and trigger "child_moved" events

    // Check for child added, removed, changed
    if (oldModel.exists()) {
      if (!newModel.hasChildren()) {
        if (!newModel.exists()) {
          // Trigger "child_removed" on the parent for this node
          if (path.parent)
            subject.next({type: 'child_removed', path: path.parent, model: oldModel, tag});

          // Trigger value and child_removed for any descendants
          this.cascadeNodeRemoved(path, oldModel, tag, false);
        } else {
          if (path.parent)
            subject.next({type: 'child_changed', path: path.parent, model: newModel, tag});
        }
      }
    } else {
      if (newModel.exists() && path.parent) {
        subject.next({type: 'child_added', path: path.parent, model: newModel, tag});
      }
    }

    subject.next({type: 'value', path: path, model: newModel, tag});

    if (bubbleUp) {
      let bubbleUpModel = newModel;
      let bubbleUpPath = path;

      while (bubbleUpModel.parent) {
        subject.next({type: 'value', path: bubbleUpPath.parent, model: bubbleUpModel.parent, tag});
        bubbleUpModel = bubbleUpModel.parent;
        bubbleUpPath = bubbleUpPath.parent;
      }
    }
  }

  private cascadeNodeRemoved(path: Path, model: DataModel, tag?: number, valueEvent = true) {
    if (model.hasChildren()) {
      model.children.forEach((child: DataModel) => {
        // Recursively process any children
        this.cascadeNodeRemoved(path.child(child.key), child, tag);

        // trigger a "child_removed" event on the path (parent) for this child
        this._subject.next({type: 'child_removed', path: path, model: child, tag});
      });

      if (valueEvent) {
        // Trigger a "value" evnet for this node
        this._subject.next({type: 'value', path: path, model, tag});
      }
    }
  }

}


/**
 * @internal
 */
export interface NotifierEvent {
  type: EventType;
  path: Path;
  model: DataModel;
  tag?: number; // Query tag
}
